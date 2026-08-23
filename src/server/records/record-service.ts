import 'server-only';

import { and, desc, eq, gte, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, climbingRecords, gymGrades, gyms, memberships, recordCounts, users } from '../db/schema';
import { ApiError } from '../http/api-error';
import { CreateRecordInput, ListRecordsInput } from './record-validation';
import { auditEventValues, writeAuditEvent } from '../observability/audit';

export async function createRecord(userId: string, input: CreateRecordInput) {
  const database = getDatabase();

  const record = await database.transaction(async (transaction) => {
    const [user, gym] = await Promise.all([
      transaction.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1),
      transaction
        .select({ id: gyms.id, name: gyms.name, branchName: gyms.branchName })
        .from(gyms)
        .where(eq(gyms.id, input.gymId))
        .limit(1),
    ]);

    if (!user[0]) throw new ApiError(404, 'USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    if (!gym[0]) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');

    let selectedMembership: { id: string; name: string; gymId: string | null } | null = null;
    if (input.membershipId) {
      const membership = await transaction
        .select({ id: memberships.id, name: memberships.name, gymId: memberships.gymId })
        .from(memberships)
        .where(and(eq(memberships.id, input.membershipId), eq(memberships.userId, userId)))
        .limit(1);

      if (!membership[0]) throw new ApiError(404, 'MEMBERSHIP_NOT_FOUND', '회원권을 찾을 수 없습니다.');
      if (membership[0].gymId && membership[0].gymId !== input.gymId) {
        throw new ApiError(400, 'MEMBERSHIP_GYM_MISMATCH', '선택한 암장에서 사용할 수 없는 회원권입니다.');
      }
      selectedMembership = membership[0];
    }

    const gradeIds = [...new Set(input.counts.map((count) => count.gymGradeId))];
    const validGrades = gradeIds.length > 0
      ? await transaction
        .select({
          id: gymGrades.id,
          code: gymGrades.code,
          label: gymGrades.label,
          color: gymGrades.color,
          rank: gymGrades.rank,
        })
        .from(gymGrades)
        .where(and(eq(gymGrades.gymId, input.gymId), inArray(gymGrades.id, gradeIds)))
      : [];
    if (gradeIds.length > 0) {
      if (validGrades.length !== gradeIds.length) {
        throw new ApiError(400, 'GRADE_GYM_MISMATCH', '선택한 암장의 난이도만 기록할 수 있습니다.');
      }
    }

    const [record] = await transaction
      .insert(climbingRecords)
      .values({
        userId,
        gymId: input.gymId,
        membershipId: input.membershipId ?? null,
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
        rating: input.rating ?? null,
        mode: input.mode,
      })
      .returning();

    const counts = input.counts.length > 0
      ? await transaction.insert(recordCounts).values(
        input.counts.map((count) => ({
          recordId: record.id,
          gymGradeId: count.gymGradeId,
          sectorCode: count.sectorCode ?? null,
          attempts: count.attempts,
          sends: count.sends,
        })),
      ).returning()
      : [];

    const gradesById = new Map(validGrades.map((grade) => [grade.id, grade]));
    const result = {
      id: record.id,
      gym: gym[0],
      membership: selectedMembership
        ? { id: selectedMembership.id, name: selectedMembership.name }
        : null,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      rating: record.rating,
      mode: record.mode,
      sends: counts.reduce((total, count) => total + count.sends, 0),
      attempts: counts.reduce((total, count) => total + count.attempts, 0),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      counts: counts.map((count) => ({
        id: count.id,
        sectorCode: count.sectorCode,
        attempts: count.attempts,
        sends: count.sends,
        grade: gradesById.get(count.gymGradeId)!,
      })),
    };
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'record.create',
      resourceType: 'climbing_record',
      resourceId: record.id,
    }));
    return result;
  });

  return record;
}

function decodeCursor(cursor: string) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== 'string' || typeof parsed[1] !== 'string') {
      throw new Error('Invalid cursor shape');
    }
    const createdAt = new Date(parsed[0]);
    if (Number.isNaN(createdAt.getTime()) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed[1])) {
      throw new Error('Invalid cursor value');
    }
    return { createdAt, id: parsed[1] };
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', '페이지 커서가 올바르지 않습니다.');
  }
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify([createdAt.toISOString(), id])).toString('base64url');
}

export async function listRecords(userId: string, input: ListRecordsInput) {
  const database = getDatabase();
  const conditions = [eq(climbingRecords.userId, userId)];

  if (input.from) conditions.push(gte(climbingRecords.startedAt, new Date(input.from)));
  if (input.to) conditions.push(lte(climbingRecords.startedAt, new Date(input.to)));
  if (input.gymId) conditions.push(eq(climbingRecords.gymId, input.gymId));
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor);
    conditions.push(or(
      lt(climbingRecords.createdAt, cursor.createdAt),
      and(eq(climbingRecords.createdAt, cursor.createdAt), lt(climbingRecords.id, cursor.id)),
    )!);
  }

  const rows = await database
    .select({
      id: climbingRecords.id,
      gym: { id: gyms.id, name: gyms.name, branchName: gyms.branchName },
      membership: { id: memberships.id, name: memberships.name },
      startedAt: climbingRecords.startedAt,
      endedAt: climbingRecords.endedAt,
      rating: climbingRecords.rating,
      mode: climbingRecords.mode,
      sends: sql<number>`coalesce(sum(${recordCounts.sends}), 0)`.mapWith(Number),
      attempts: sql<number>`coalesce(sum(${recordCounts.attempts}), 0)`.mapWith(Number),
      createdAt: climbingRecords.createdAt,
    })
    .from(climbingRecords)
    .innerJoin(gyms, eq(climbingRecords.gymId, gyms.id))
    .leftJoin(memberships, eq(climbingRecords.membershipId, memberships.id))
    .leftJoin(recordCounts, eq(climbingRecords.id, recordCounts.recordId))
    .where(and(...conditions))
    .groupBy(climbingRecords.id, gyms.id, memberships.id)
    .orderBy(desc(climbingRecords.createdAt), desc(climbingRecords.id))
    .limit(input.limit + 1);

  const hasNextPage = rows.length > input.limit;
  const data = hasNextPage ? rows.slice(0, input.limit) : rows;

  const result = {
    data,
    meta: {
      nextCursor: hasNextPage && data.length > 0
        ? encodeCursor(data[data.length - 1].createdAt, data[data.length - 1].id)
        : null,
    },
  };
  await writeAuditEvent({
    action: 'record.list',
    resourceType: 'climbing_record',
    metadata: { resultCount: data.length, filteredByGym: Boolean(input.gymId) },
  });
  return result;
}

export async function getRecord(userId: string, recordId: string, audit = true) {
  const database = getDatabase();
  const records = await database
    .select({
      id: climbingRecords.id,
      gym: { id: gyms.id, name: gyms.name, branchName: gyms.branchName },
      membership: { id: memberships.id, name: memberships.name },
      startedAt: climbingRecords.startedAt,
      endedAt: climbingRecords.endedAt,
      rating: climbingRecords.rating,
      mode: climbingRecords.mode,
      createdAt: climbingRecords.createdAt,
      updatedAt: climbingRecords.updatedAt,
    })
    .from(climbingRecords)
    .innerJoin(gyms, eq(climbingRecords.gymId, gyms.id))
    .leftJoin(memberships, eq(climbingRecords.membershipId, memberships.id))
    .where(and(eq(climbingRecords.id, recordId), eq(climbingRecords.userId, userId)))
    .limit(1);

  if (!records[0]) throw new ApiError(404, 'RECORD_NOT_FOUND', '기록을 찾을 수 없습니다.');

  const counts = await database
    .select({
      id: recordCounts.id,
      sectorCode: recordCounts.sectorCode,
      attempts: recordCounts.attempts,
      sends: recordCounts.sends,
      grade: {
        id: gymGrades.id,
        code: gymGrades.code,
        label: gymGrades.label,
        color: gymGrades.color,
        rank: gymGrades.rank,
      },
    })
    .from(recordCounts)
    .innerJoin(gymGrades, eq(recordCounts.gymGradeId, gymGrades.id))
    .where(eq(recordCounts.recordId, recordId))
    .orderBy(gymGrades.rank, recordCounts.sectorCode);

  const totals = counts.reduce(
    (summary, count) => ({ sends: summary.sends + count.sends, attempts: summary.attempts + count.attempts }),
    { sends: 0, attempts: 0 },
  );
  const record = { ...records[0], ...totals, counts };
  if (audit) await writeAuditEvent({ action: 'record.read', resourceType: 'climbing_record', resourceId: recordId });
  return record;
}
