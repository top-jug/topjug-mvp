import 'server-only';

import { and, desc, eq, gt, gte, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import {
  auditEvents,
  climbingRecords,
  gymGrades,
  gymMedia,
  gyms,
  gymSectors,
  gymWalls,
  mediaAssets,
  membershipGyms,
  memberships,
  membershipUsages,
  recordCounts,
  users,
} from '../db/schema';
import { ApiError } from '../http/api-error';
import { publicMediaUrl } from '../media/media-url';
import { CreateRecordInput, ListRecordsInput } from './record-validation';
import { auditEventValues, writeAuditEvent } from '../observability/audit';

function mediaReference(asset: {
  id: string;
  storageKey: string;
  contentType: string;
}) {
  return { ...asset, url: publicMediaUrl(asset.storageKey) };
}

async function getGymLogos(gymIds: string[]) {
  if (gymIds.length === 0) return new Map<string, ReturnType<typeof mediaReference>>();

  const logos = await getDatabase()
    .select({
      gymId: gymMedia.gymId,
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      contentType: mediaAssets.contentType,
    })
    .from(gymMedia)
    .innerJoin(mediaAssets, eq(gymMedia.mediaAssetId, mediaAssets.id))
    .where(and(inArray(gymMedia.gymId, gymIds), eq(gymMedia.type, 'logo'), eq(mediaAssets.status, 'ready')))
    .orderBy(gymMedia.sortOrder);

  const logoByGym = new Map<string, ReturnType<typeof mediaReference>>();
  for (const logo of logos) {
    if (!logoByGym.has(logo.gymId)) logoByGym.set(logo.gymId, mediaReference(logo));
  }

  return logoByGym;
}

async function attachGymLogos<T extends { gym: { id: string } }>(records: T[]) {
  const logoByGym = await getGymLogos([...new Set(records.map((record) => record.gym.id))]);
  return records.map((record) => ({
    ...record,
    gym: { ...record.gym, logo: logoByGym.get(record.gym.id) ?? null },
  }));
}

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

    let selectedMembership: { id: string; name: string; type: 'count' | 'period' } | null = null;
    if (input.membershipId) {
      const membership = await transaction
        .select({
          id: memberships.id,
          name: memberships.name,
          type: memberships.type,
          remainingUses: memberships.remainingUses,
          validFrom: memberships.validFrom,
          validUntil: memberships.validUntil,
          archivedAt: memberships.archivedAt,
        })
        .from(memberships)
        .where(and(eq(memberships.id, input.membershipId), eq(memberships.userId, userId)))
        .limit(1)
        .for('update');

      if (!membership[0]) throw new ApiError(404, 'MEMBERSHIP_NOT_FOUND', '회원권을 찾을 수 없습니다.');
      if (membership[0].archivedAt) throw new ApiError(400, 'MEMBERSHIP_ARCHIVED', '보관된 회원권은 사용할 수 없습니다.');
      const eligibleGym = await transaction
        .select({ gymId: membershipGyms.gymId })
        .from(membershipGyms)
        .where(and(
          eq(membershipGyms.membershipId, input.membershipId),
          eq(membershipGyms.gymId, input.gymId),
        ))
        .limit(1);
      if (!eligibleGym[0]) {
        throw new ApiError(400, 'MEMBERSHIP_GYM_MISMATCH', '선택한 암장에서 사용할 수 없는 회원권입니다.');
      }
      const startedAt = new Date(input.startedAt);
      if (startedAt < membership[0].validFrom || startedAt > membership[0].validUntil) {
        throw new ApiError(400, 'MEMBERSHIP_NOT_ACTIVE', '기록 시각에 유효한 회원권이 아닙니다.');
      }
      if (membership[0].type === 'count' && (membership[0].remainingUses ?? 0) <= 0) {
        throw new ApiError(400, 'MEMBERSHIP_EXHAUSTED', '남은 이용 횟수가 없습니다.');
      }
      selectedMembership = { id: membership[0].id, name: membership[0].name, type: membership[0].type };
    }

    const gradeIds = [...new Set(input.counts.map((count) => count.gymGradeId))];
    const sectorIds = [...new Set(input.counts.map((count) => count.gymSectorId))];
    const [validGrades, validSectors] = await Promise.all([
      gradeIds.length > 0 ? transaction
        .select({
          id: gymGrades.id,
          code: gymGrades.code,
          label: gymGrades.label,
          color: gymGrades.color,
          standardCode: gymGrades.standardCode,
          rank: gymGrades.rank,
        })
        .from(gymGrades)
        .where(and(eq(gymGrades.gymId, input.gymId), inArray(gymGrades.id, gradeIds)))
        : Promise.resolve([]),
      sectorIds.length > 0 ? transaction
        .select({
          id: gymSectors.id,
          code: gymSectors.code,
          name: gymSectors.name,
          sortOrder: gymSectors.sortOrder,
          isActive: gymSectors.isActive,
          wallIsActive: gymWalls.isActive,
          wall: { id: gymWalls.id, code: gymWalls.code, name: gymWalls.name },
        })
        .from(gymSectors)
        .innerJoin(gymWalls, eq(gymSectors.wallId, gymWalls.id))
        .where(and(
          eq(gymWalls.gymId, input.gymId),
          eq(gymWalls.isActive, true),
          eq(gymSectors.isActive, true),
          inArray(gymSectors.id, sectorIds),
        ))
        : Promise.resolve([]),
    ]);
    if (validGrades.length !== gradeIds.length) {
      throw new ApiError(400, 'GRADE_GYM_MISMATCH', '선택한 암장의 난이도만 기록할 수 있습니다.');
    }
    if (validSectors.length !== sectorIds.length) {
      throw new ApiError(400, 'SECTOR_GYM_MISMATCH', '선택한 암장의 섹터만 기록할 수 있습니다.');
    }

    const [record] = await transaction
      .insert(climbingRecords)
      .values({
        userId,
        gymId: input.gymId,
        membershipId: input.membershipId ?? null,
        accessType: input.accessType,
        status: 'completed',
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
        activeDurationSeconds: input.activeDurationSeconds,
        rating: input.rating ?? null,
        mode: input.mode,
        note: input.note ?? null,
      })
      .returning({
        id: climbingRecords.id,
        startedAt: climbingRecords.startedAt,
        endedAt: climbingRecords.endedAt,
        rating: climbingRecords.rating,
        mode: climbingRecords.mode,
        accessType: climbingRecords.accessType,
        status: climbingRecords.status,
        activeDurationSeconds: climbingRecords.activeDurationSeconds,
        note: climbingRecords.note,
        createdAt: climbingRecords.createdAt,
        updatedAt: climbingRecords.updatedAt,
      });

    const counts = input.counts.length > 0
      ? await transaction.insert(recordCounts).values(
        input.counts.map((count) => ({
          recordId: record.id,
          gymId: input.gymId,
          gymGradeId: count.gymGradeId,
          gymSectorId: count.gymSectorId,
          attempts: count.attempts,
          sends: count.sends,
        })),
      ).returning()
      : [];

    const gradesById = new Map(validGrades.map((grade) => [grade.id, grade]));
    const sectorsById = new Map(validSectors.map((sector) => [sector.id, sector]));
    if (selectedMembership?.type === 'count') {
      const [updatedMembership] = await transaction
        .update(memberships)
        .set({
          remainingUses: sql`${memberships.remainingUses} - 1`,
          updatedAt: sql`greatest(clock_timestamp(), ${memberships.updatedAt} + interval '1 millisecond')`,
        })
        .where(and(eq(memberships.id, selectedMembership.id), gt(memberships.remainingUses, 0)))
        .returning({ remainingUses: memberships.remainingUses });
      if (!updatedMembership || updatedMembership.remainingUses === null) {
        throw new ApiError(409, 'MEMBERSHIP_EXHAUSTED', '회원권 잔여 횟수가 변경되었습니다. 다시 확인해주세요.');
      }
      await transaction.insert(membershipUsages).values({
        membershipId: selectedMembership.id,
        recordId: record.id,
        type: 'consume',
        delta: -1,
        balanceAfter: updatedMembership.remainingUses,
      });
    }
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
      accessType: record.accessType,
      status: record.status,
      activeDurationSeconds: record.activeDurationSeconds,
      note: record.note,
      sends: counts.reduce((total, count) => total + count.sends, 0),
      attempts: counts.reduce((total, count) => total + count.attempts, 0),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      counts: counts.map((count) => ({
        id: count.id,
        sector: {
          id: sectorsById.get(count.gymSectorId)!.id,
          code: sectorsById.get(count.gymSectorId)!.code,
          name: sectorsById.get(count.gymSectorId)!.name,
          sortOrder: sectorsById.get(count.gymSectorId)!.sortOrder,
          isActive: sectorsById.get(count.gymSectorId)!.isActive,
        },
        wall: sectorsById.get(count.gymSectorId)!.wall,
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

  return (await attachGymLogos([record]))[0];
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
  const conditions = [eq(climbingRecords.userId, userId), eq(climbingRecords.status, 'completed' as const)];

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
      accessType: climbingRecords.accessType,
      status: climbingRecords.status,
      activeDurationSeconds: climbingRecords.activeDurationSeconds,
      note: climbingRecords.note,
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
  const pageRows = hasNextPage ? rows.slice(0, input.limit) : rows;
  const data = await attachGymLogos(pageRows);

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

type RecordTransaction = Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0];

export async function getRecord(userId: string, recordId: string, audit = true, transaction?: RecordTransaction) {
  const database = transaction ?? getDatabase();
  const records = await database
    .select({
      id: climbingRecords.id,
      gym: { id: gyms.id, name: gyms.name, branchName: gyms.branchName },
      membership: { id: memberships.id, name: memberships.name },
      startedAt: climbingRecords.startedAt,
      endedAt: climbingRecords.endedAt,
      rating: climbingRecords.rating,
      mode: climbingRecords.mode,
      accessType: climbingRecords.accessType,
      status: climbingRecords.status,
      activeDurationSeconds: climbingRecords.activeDurationSeconds,
      note: climbingRecords.note,
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
      sector: {
        id: gymSectors.id,
        code: gymSectors.code,
        name: gymSectors.name,
        sortOrder: gymSectors.sortOrder,
        isActive: gymSectors.isActive,
      },
      wall: { id: gymWalls.id, code: gymWalls.code, name: gymWalls.name },
      attempts: recordCounts.attempts,
      sends: recordCounts.sends,
      grade: {
        id: gymGrades.id,
        code: gymGrades.code,
        label: gymGrades.label,
        color: gymGrades.color,
        standardCode: gymGrades.standardCode,
        rank: gymGrades.rank,
      },
    })
    .from(recordCounts)
    .innerJoin(gymGrades, eq(recordCounts.gymGradeId, gymGrades.id))
    .innerJoin(gymSectors, eq(recordCounts.gymSectorId, gymSectors.id))
    .innerJoin(gymWalls, eq(gymSectors.wallId, gymWalls.id))
    .where(eq(recordCounts.recordId, recordId))
    .orderBy(gymWalls.sortOrder, gymSectors.sortOrder, gymGrades.rank);

  const totals = counts.reduce(
    (summary, count) => ({ sends: summary.sends + count.sends, attempts: summary.attempts + count.attempts }),
    { sends: 0, attempts: 0 },
  );
  const [record] = await attachGymLogos([{ ...records[0], ...totals, counts }]);
  if (audit) await writeAuditEvent({ action: 'record.read', resourceType: 'climbing_record', resourceId: recordId });
  return record;
}
