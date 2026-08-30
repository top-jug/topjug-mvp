import 'server-only';

import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import {
  auditEvents,
  climbingRecords,
  gymGrades,
  gyms,
  gymSectors,
  gymWalls,
  membershipGyms,
  memberships,
  membershipUsages,
  recordCounts,
  recordPauses,
} from '../db/schema';
import { ApiError } from '../http/api-error';
import { auditEventValues } from '../observability/audit';
import { getRecord } from './record-service';
import { CompleteRecordSessionInput, RecordSessionCountsInput, StartRecordSessionInput } from './record-validation';

type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0];

async function validateMembership(
  transaction: Transaction,
  userId: string,
  gymId: string,
  membershipId: string,
  at: Date,
  lock: boolean,
) {
  let query = transaction.select().from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.userId, userId), isNull(memberships.archivedAt)))
    .limit(1);
  const rows = lock ? await query.for('update') : await query;
  const membership = rows[0];
  if (!membership) throw new ApiError(404, 'MEMBERSHIP_NOT_FOUND', '회원권을 찾을 수 없습니다.');
  const [eligible] = await transaction.select({ gymId: membershipGyms.gymId }).from(membershipGyms)
    .where(and(eq(membershipGyms.membershipId, membershipId), eq(membershipGyms.gymId, gymId))).limit(1);
  if (!eligible) throw new ApiError(400, 'MEMBERSHIP_GYM_MISMATCH', '선택한 암장에서 사용할 수 없는 회원권입니다.');
  if (at < membership.validFrom || at > membership.validUntil) throw new ApiError(400, 'MEMBERSHIP_NOT_ACTIVE', '기록 시각에 유효한 회원권이 아닙니다.');
  if (membership.type === 'count' && (membership.remainingUses ?? 0) <= 0) throw new ApiError(400, 'MEMBERSHIP_EXHAUSTED', '남은 이용 횟수가 없습니다.');
  return membership;
}

async function validateCounts(transaction: Transaction, gymId: string, counts: RecordSessionCountsInput['counts']) {
  const gradeIds = [...new Set(counts.map((count) => count.gymGradeId))];
  const sectorIds = [...new Set(counts.map((count) => count.gymSectorId))];
  const [grades, sectors] = await Promise.all([
    gradeIds.length ? transaction.select({ id: gymGrades.id }).from(gymGrades)
      .where(and(eq(gymGrades.gymId, gymId), inArray(gymGrades.id, gradeIds))) : Promise.resolve([]),
    sectorIds.length ? transaction.select({ id: gymSectors.id }).from(gymSectors)
      .innerJoin(gymWalls, eq(gymSectors.wallId, gymWalls.id))
      .where(and(eq(gymSectors.gymId, gymId), eq(gymSectors.isActive, true), eq(gymWalls.isActive, true), inArray(gymSectors.id, sectorIds)))
      : Promise.resolve([]),
  ]);
  if (grades.length !== gradeIds.length) throw new ApiError(400, 'GRADE_GYM_MISMATCH', '선택한 암장의 난이도만 기록할 수 있습니다.');
  if (sectors.length !== sectorIds.length) throw new ApiError(400, 'SECTOR_GYM_MISMATCH', '활성화된 암장 섹터만 기록할 수 있습니다.');
}

export async function startRecordSession(userId: string, input: StartRecordSessionInput) {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 3))`);
    const [active] = await transaction.select({ id: climbingRecords.id }).from(climbingRecords)
      .where(and(eq(climbingRecords.userId, userId), eq(climbingRecords.status, 'in_progress'))).limit(1);
    if (active) throw new ApiError(409, 'ACTIVE_RECORD_EXISTS', '이미 진행 중인 기록이 있습니다.');
    const [gym] = await transaction.select({ id: gyms.id }).from(gyms).where(eq(gyms.id, input.gymId)).limit(1);
    if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
    if (input.membershipId) await validateMembership(transaction, userId, input.gymId, input.membershipId, new Date(input.startedAt), true);
    const [record] = await transaction.insert(climbingRecords).values({
      userId,
      gymId: input.gymId,
      membershipId: input.membershipId ?? null,
      accessType: input.accessType,
      status: 'in_progress',
      startedAt: new Date(input.startedAt),
      mode: input.mode,
      note: input.note ?? null,
    }).returning({
      id: climbingRecords.id,
      userId: climbingRecords.userId,
      gymId: climbingRecords.gymId,
      membershipId: climbingRecords.membershipId,
      accessType: climbingRecords.accessType,
      status: climbingRecords.status,
      startedAt: climbingRecords.startedAt,
      endedAt: climbingRecords.endedAt,
      activeDurationSeconds: climbingRecords.activeDurationSeconds,
      rating: climbingRecords.rating,
      mode: climbingRecords.mode,
      note: climbingRecords.note,
      createdAt: climbingRecords.createdAt,
      updatedAt: climbingRecords.updatedAt,
    });
    await transaction.insert(auditEvents).values(auditEventValues({ action: 'record.start', resourceType: 'climbing_record', resourceId: record.id }));
    return record;
  });
}

export async function getActiveRecordSession(userId: string) {
  return getDatabase().transaction(async (transaction) => {
    const [active] = await transaction.select({ id: climbingRecords.id }).from(climbingRecords)
      .where(and(eq(climbingRecords.userId, userId), eq(climbingRecords.status, 'in_progress'))).limit(1).for('update');
    if (!active) return null;
    const [record, pauses] = await Promise.all([
      getRecord(userId, active.id, false, transaction),
      transaction.select().from(recordPauses).where(eq(recordPauses.recordId, active.id)).orderBy(recordPauses.pausedAt),
    ]);
    return { ...record, isPaused: pauses.some((pause) => pause.resumedAt === null), pauses };
  });
}

export async function replaceRecordSessionCounts(userId: string, recordId: string, input: RecordSessionCountsInput) {
  await getDatabase().transaction(async (transaction) => {
    const [record] = await transaction.select({ id: climbingRecords.id, gymId: climbingRecords.gymId, status: climbingRecords.status })
      .from(climbingRecords).where(and(eq(climbingRecords.id, recordId), eq(climbingRecords.userId, userId))).limit(1).for('update');
    if (!record || record.status !== 'in_progress') throw new ApiError(404, 'ACTIVE_RECORD_NOT_FOUND', '진행 중인 기록을 찾을 수 없습니다.');
    await validateCounts(transaction, record.gymId, input.counts);
    await transaction.delete(recordCounts).where(eq(recordCounts.recordId, recordId));
    if (input.counts.length) await transaction.insert(recordCounts).values(input.counts.map((count) => ({
      recordId, gymId: record.gymId, gymGradeId: count.gymGradeId, gymSectorId: count.gymSectorId,
      attempts: count.attempts, sends: count.sends,
    })));
  });
  return getRecord(userId, recordId, false);
}

export async function pauseRecordSession(userId: string, recordId: string, at = new Date()) {
  return getDatabase().transaction(async (transaction) => {
    const [record] = await transaction.select({
      status: climbingRecords.status,
      startedAt: climbingRecords.startedAt,
    }).from(climbingRecords)
      .where(and(eq(climbingRecords.id, recordId), eq(climbingRecords.userId, userId))).limit(1).for('update');
    if (!record || record.status !== 'in_progress') throw new ApiError(404, 'ACTIVE_RECORD_NOT_FOUND', '진행 중인 기록을 찾을 수 없습니다.');
    if (at < record.startedAt) throw new ApiError(400, 'INVALID_PAUSE_TIME', '일시정지 시각이 기록 시작보다 빠를 수 없습니다.');
    const [openPause] = await transaction.select({ id: recordPauses.id }).from(recordPauses)
      .where(and(eq(recordPauses.recordId, recordId), isNull(recordPauses.resumedAt))).limit(1);
    if (openPause) throw new ApiError(409, 'RECORD_ALREADY_PAUSED', '이미 일시정지된 기록입니다.');
    const [latestPause] = await transaction.select({ resumedAt: recordPauses.resumedAt }).from(recordPauses)
      .where(eq(recordPauses.recordId, recordId)).orderBy(desc(recordPauses.pausedAt)).limit(1);
    if (latestPause?.resumedAt && at < latestPause.resumedAt) {
      throw new ApiError(400, 'INVALID_PAUSE_TIME', '이전 재개 시각보다 빠르게 일시정지할 수 없습니다.');
    }
    const [pause] = await transaction.insert(recordPauses).values({ recordId, pausedAt: at }).returning();
    return pause;
  });
}

export async function resumeRecordSession(userId: string, recordId: string, at = new Date()) {
  return getDatabase().transaction(async (transaction) => {
    const [record] = await transaction.select({ id: climbingRecords.id, status: climbingRecords.status }).from(climbingRecords)
      .where(and(eq(climbingRecords.id, recordId), eq(climbingRecords.userId, userId))).limit(1).for('update');
    if (!record || record.status !== 'in_progress') throw new ApiError(404, 'ACTIVE_RECORD_NOT_FOUND', '진행 중인 기록을 찾을 수 없습니다.');
    const [pause] = await transaction.select().from(recordPauses)
      .where(and(eq(recordPauses.recordId, recordId), isNull(recordPauses.resumedAt))).limit(1).for('update');
    if (!pause) throw new ApiError(409, 'RECORD_NOT_PAUSED', '일시정지된 기록이 아닙니다.');
    if (at < pause.pausedAt) throw new ApiError(400, 'INVALID_RESUME_TIME', '재개 시각이 일시정지보다 빠를 수 없습니다.');
    const [resumed] = await transaction.update(recordPauses).set({ resumedAt: at }).where(eq(recordPauses.id, pause.id)).returning();
    return resumed;
  });
}

export async function completeRecordSession(userId: string, recordId: string, input: CompleteRecordSessionInput) {
  await getDatabase().transaction(async (transaction) => {
    const [record] = await transaction.select({
      status: climbingRecords.status,
      startedAt: climbingRecords.startedAt,
      gymId: climbingRecords.gymId,
      membershipId: climbingRecords.membershipId,
      note: climbingRecords.note,
    }).from(climbingRecords)
      .where(and(eq(climbingRecords.id, recordId), eq(climbingRecords.userId, userId))).limit(1).for('update');
    if (!record || record.status !== 'in_progress') throw new ApiError(404, 'ACTIVE_RECORD_NOT_FOUND', '진행 중인 기록을 찾을 수 없습니다.');
    const endedAt = new Date(input.endedAt);
    if (endedAt < record.startedAt) throw new ApiError(400, 'INVALID_END_TIME', '종료 시각이 시작보다 빠를 수 없습니다.');

    const pauses = await transaction.select().from(recordPauses).where(eq(recordPauses.recordId, recordId)).for('update');
    let pausedMs = 0;
    for (const pause of pauses) {
      const resumedAt = pause.resumedAt ?? endedAt;
      if (resumedAt > endedAt || pause.pausedAt > endedAt) throw new ApiError(400, 'INVALID_PAUSE_RANGE', '일시정지 구간이 기록 종료 이후입니다.');
      pausedMs += resumedAt.getTime() - pause.pausedAt.getTime();
      if (!pause.resumedAt) await transaction.update(recordPauses).set({ resumedAt: endedAt }).where(eq(recordPauses.id, pause.id));
    }
    const activeDurationSeconds = Math.floor((endedAt.getTime() - record.startedAt.getTime() - pausedMs) / 1000);
    if (activeDurationSeconds < 0) throw new ApiError(400, 'INVALID_ACTIVE_DURATION', '활동 시간을 계산할 수 없습니다.');

    await validateCounts(transaction, record.gymId, input.counts);

    let membership: typeof memberships.$inferSelect | null = null;
    if (record.membershipId) membership = await validateMembership(transaction, userId, record.gymId, record.membershipId, record.startedAt, true);
    await transaction.update(climbingRecords).set({
      status: 'completed', endedAt, activeDurationSeconds, rating: input.rating ?? null, note: input.note ?? record.note, updatedAt: new Date(),
    }).where(eq(climbingRecords.id, recordId));
    await transaction.delete(recordCounts).where(eq(recordCounts.recordId, recordId));
    if (input.counts.length) await transaction.insert(recordCounts).values(input.counts.map((count) => ({
      recordId, gymId: record.gymId, gymGradeId: count.gymGradeId, gymSectorId: count.gymSectorId, attempts: count.attempts, sends: count.sends,
    })));
    if (membership?.type === 'count') {
      const [updated] = await transaction.update(memberships)
        .set({
          remainingUses: sql`${memberships.remainingUses} - 1`,
          updatedAt: sql`greatest(clock_timestamp(), ${memberships.updatedAt} + interval '1 millisecond')`,
        })
        .where(and(eq(memberships.id, membership.id), gt(memberships.remainingUses, 0)))
        .returning({ remainingUses: memberships.remainingUses });
      if (!updated?.remainingUses && updated?.remainingUses !== 0) throw new ApiError(409, 'MEMBERSHIP_EXHAUSTED', '회원권 잔여 횟수가 변경되었습니다.');
      await transaction.insert(membershipUsages).values({ membershipId: membership.id, recordId, type: 'consume', delta: -1, balanceAfter: updated.remainingUses! });
    }
    await transaction.insert(auditEvents).values(auditEventValues({ action: 'record.complete', resourceType: 'climbing_record', resourceId: recordId }));
  });
  return getRecord(userId, recordId, false);
}

export async function cancelRecordSession(userId: string, recordId: string, at = new Date()) {
  await getDatabase().transaction(async (transaction) => {
    const [existing] = await transaction.select({ startedAt: climbingRecords.startedAt }).from(climbingRecords)
      .where(and(eq(climbingRecords.id, recordId), eq(climbingRecords.userId, userId), eq(climbingRecords.status, 'in_progress')))
      .limit(1).for('update');
    if (!existing) throw new ApiError(404, 'ACTIVE_RECORD_NOT_FOUND', '진행 중인 기록을 찾을 수 없습니다.');
    if (at < existing.startedAt) throw new ApiError(400, 'INVALID_CANCEL_TIME', '취소 시각이 기록 시작보다 빠를 수 없습니다.');
    const pauses = await transaction.select().from(recordPauses)
      .where(eq(recordPauses.recordId, recordId)).for('update');
    if (pauses.some((pause) => pause.pausedAt > at || (pause.resumedAt && pause.resumedAt > at))) {
      throw new ApiError(400, 'INVALID_CANCEL_TIME', '취소 시각이 일시정지 이력보다 빠를 수 없습니다.');
    }
    await transaction.update(recordPauses).set({ resumedAt: at })
      .where(and(eq(recordPauses.recordId, recordId), isNull(recordPauses.resumedAt)));
    await transaction.update(climbingRecords).set({ status: 'cancelled', endedAt: at, updatedAt: new Date() })
      .where(eq(climbingRecords.id, recordId));
    await transaction.insert(auditEvents).values(auditEventValues({ action: 'record.cancel', resourceType: 'climbing_record', resourceId: recordId }));
  });
  return getRecord(userId, recordId, false);
}
