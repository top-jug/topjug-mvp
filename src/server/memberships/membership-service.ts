import 'server-only';

import { and, count, desc, eq, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, climbingRecords, gyms, membershipGyms, memberships, membershipUsages } from '../db/schema';
import { ApiError } from '../http/api-error';
import { auditEventValues } from '../observability/audit';
import { MembershipInput } from './membership-validation';

async function validateGyms(transaction: Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0], gymIds: string[]) {
  if (gymIds.length === 0) return [];
  const rows = await transaction.select({ id: gyms.id, name: gyms.name, branchName: gyms.branchName }).from(gyms).where(inArray(gyms.id, gymIds));
  if (rows.length !== gymIds.length) throw new ApiError(400, 'INVALID_MEMBERSHIP_GYMS', '존재하는 암장만 지정할 수 있습니다.');
  return rows;
}

async function validateHomePosition(
  transaction: Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0],
  userId: string,
  input: MembershipInput,
  membershipId?: string,
) {
  if (!input.homeFavorite) return;
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 2))`);
  const conditions = [eq(memberships.userId, userId), isNull(memberships.archivedAt), eq(memberships.homeFavorite, true)];
  if (membershipId) conditions.push(ne(memberships.id, membershipId));
  const [result] = await transaction.select({ total: count() }).from(memberships).where(and(...conditions));
  if (result.total >= 3) throw new ApiError(409, 'HOME_MEMBERSHIP_LIMIT', '홈에는 회원권을 최대 3개까지 표시할 수 있습니다.');
  const orderConditions = [...conditions, eq(memberships.homeOrder, input.homeOrder!)];
  const [occupied] = await transaction.select({ id: memberships.id }).from(memberships).where(and(...orderConditions)).limit(1);
  if (occupied) throw new ApiError(409, 'HOME_MEMBERSHIP_ORDER_OCCUPIED', '이미 사용 중인 홈 표시 순서입니다.');
}

export async function listMemberships(userId: string) {
  const database = getDatabase();
  const rows = await database.select().from(memberships)
    .where(and(eq(memberships.userId, userId), isNull(memberships.archivedAt)))
    .orderBy(desc(memberships.homeFavorite), memberships.homeOrder, desc(memberships.createdAt));
  const ids = rows.map((row) => row.id);
  const eligibleGyms = ids.length > 0
    ? await database.select({ membershipId: membershipGyms.membershipId, id: gyms.id, name: gyms.name, branchName: gyms.branchName })
      .from(membershipGyms).innerJoin(gyms, eq(membershipGyms.gymId, gyms.id))
      .where(inArray(membershipGyms.membershipId, ids)).orderBy(gyms.name, gyms.branchName)
    : [];
  const gymsByMembership = new Map<string, Array<{ id: string; name: string; branchName: string | null }>>();
  for (const gym of eligibleGyms) {
    gymsByMembership.set(gym.membershipId, [...(gymsByMembership.get(gym.membershipId) ?? []), {
      id: gym.id, name: gym.name, branchName: gym.branchName,
    }]);
  }
  const now = new Date();
  return { data: rows.map((row) => {
    const eligible = gymsByMembership.get(row.id) ?? [];
    const eligibilityStatus = eligible.length === 0 ? 'unassigned'
      : now < row.validFrom ? 'not_started'
        : now > row.validUntil ? 'expired'
          : row.type === 'count' && row.remainingUses === 0 ? 'exhausted'
            : 'active';
    return { ...row, gymIds: eligible.map((gym) => gym.id), gyms: eligible, eligibilityStatus };
  }) };
}

export async function createMembership(userId: string, input: MembershipInput) {
  return getDatabase().transaction(async (transaction) => {
    const [eligibleGyms] = await Promise.all([validateGyms(transaction, input.gymIds), validateHomePosition(transaction, userId, input)]);
    const [membership] = await transaction.insert(memberships).values({
      userId,
      name: input.name,
      type: input.type,
      totalUses: input.type === 'count' ? input.totalUses : null,
      remainingUses: input.type === 'count' ? input.remainingUses : null,
      validFrom: new Date(input.validFrom),
      validUntil: new Date(input.validUntil),
      note: input.note ?? null,
      homeFavorite: input.homeFavorite,
      homeOrder: input.homeOrder ?? null,
    }).returning();
    if (input.gymIds.length > 0) {
      await transaction.insert(membershipGyms).values(input.gymIds.map((gymId) => ({ membershipId: membership.id, gymId })));
    }
    await transaction.insert(auditEvents).values(auditEventValues({ action: 'membership.create', resourceType: 'membership', resourceId: membership.id }));
    const now = new Date();
    const eligibilityStatus = input.gymIds.length === 0 ? 'unassigned'
      : now < membership.validFrom ? 'not_started'
        : now > membership.validUntil ? 'expired'
          : membership.type === 'count' && membership.remainingUses === 0 ? 'exhausted'
            : 'active';
    return { ...membership, gymIds: input.gymIds, gyms: eligibleGyms, eligibilityStatus };
  });
}

export async function replaceMembership(userId: string, membershipId: string, input: MembershipInput) {
  return getDatabase().transaction(async (transaction) => {
    const [existing] = await transaction.select().from(memberships)
      .where(and(eq(memberships.id, membershipId), eq(memberships.userId, userId), isNull(memberships.archivedAt)))
      .limit(1).for('update');
    if (!existing) throw new ApiError(404, 'MEMBERSHIP_NOT_FOUND', '회원권을 찾을 수 없습니다.');
    const [[usageCount], [recordCount]] = await Promise.all([
      transaction.select({ total: count() }).from(membershipUsages).where(eq(membershipUsages.membershipId, membershipId)),
      transaction.select({ total: count() }).from(climbingRecords).where(eq(climbingRecords.membershipId, membershipId)),
    ]);
    if ((usageCount.total > 0 || recordCount.total > 0) && existing.type !== input.type) {
      throw new ApiError(409, 'MEMBERSHIP_TYPE_LOCKED', '사용 이력이 있는 회원권의 종류는 변경할 수 없습니다.');
    }
    const [eligibleGyms] = await Promise.all([
      validateGyms(transaction, input.gymIds),
      validateHomePosition(transaction, userId, input, membershipId),
    ]);
    const nextRemaining = input.type === 'count' ? input.remainingUses! : null;
    const removedGymConditions = [eq(climbingRecords.membershipId, membershipId)];
    if (input.gymIds.length > 0) removedGymConditions.push(notInArray(climbingRecords.gymId, input.gymIds));
    const [recordAtRemovedGym] = await transaction.select({ id: climbingRecords.id }).from(climbingRecords)
      .where(and(...removedGymConditions)).limit(1);
    if (recordAtRemovedGym) {
      throw new ApiError(409, 'MEMBERSHIP_GYM_LOCKED', '기록에 사용된 암장은 회원권에서 제거할 수 없습니다.');
    }
    const [membership] = await transaction.update(memberships).set({
      name: input.name,
      type: input.type,
      totalUses: input.type === 'count' ? input.totalUses : null,
      remainingUses: nextRemaining,
      validFrom: new Date(input.validFrom),
      validUntil: new Date(input.validUntil),
      note: input.note ?? null,
      homeFavorite: input.homeFavorite,
      homeOrder: input.homeOrder ?? null,
      updatedAt: new Date(),
    }).where(eq(memberships.id, membershipId)).returning();
    if (input.gymIds.length > 0) {
      await transaction.insert(membershipGyms).values(input.gymIds.map((gymId) => ({ membershipId, gymId }))).onConflictDoNothing();
      await transaction.delete(membershipGyms).where(and(
        eq(membershipGyms.membershipId, membershipId),
        notInArray(membershipGyms.gymId, input.gymIds),
      ));
    } else {
      await transaction.delete(membershipGyms).where(eq(membershipGyms.membershipId, membershipId));
    }
    if (existing.type === 'count' && input.type === 'count' && existing.remainingUses !== nextRemaining) {
      await transaction.insert(membershipUsages).values({
        membershipId,
        type: 'adjustment',
        delta: nextRemaining! - existing.remainingUses!,
        balanceAfter: nextRemaining!,
        note: 'manual_update',
      });
    }
    await transaction.insert(auditEvents).values(auditEventValues({ action: 'membership.update', resourceType: 'membership', resourceId: membershipId }));
    const now = new Date();
    const eligibilityStatus = input.gymIds.length === 0 ? 'unassigned'
      : now < membership.validFrom ? 'not_started'
        : now > membership.validUntil ? 'expired'
          : membership.type === 'count' && membership.remainingUses === 0 ? 'exhausted'
            : 'active';
    return { ...membership, gymIds: input.gymIds, gyms: eligibleGyms, eligibilityStatus };
  });
}

export async function archiveMembership(userId: string, membershipId: string) {
  await getDatabase().transaction(async (transaction) => {
    const [membership] = await transaction.update(memberships).set({
      archivedAt: new Date(), homeFavorite: false, homeOrder: null, updatedAt: new Date(),
    }).where(and(eq(memberships.id, membershipId), eq(memberships.userId, userId), isNull(memberships.archivedAt))).returning({ id: memberships.id });
    if (!membership) throw new ApiError(404, 'MEMBERSHIP_NOT_FOUND', '회원권을 찾을 수 없습니다.');
    const [activeRecord] = await transaction.select({ id: climbingRecords.id }).from(climbingRecords)
      .where(and(eq(climbingRecords.membershipId, membershipId), eq(climbingRecords.status, 'in_progress'))).limit(1);
    if (activeRecord) throw new ApiError(409, 'MEMBERSHIP_IN_USE', '진행 중인 기록에서 사용하는 회원권은 보관할 수 없습니다.');
    await transaction.insert(auditEvents).values(auditEventValues({ action: 'membership.archive', resourceType: 'membership', resourceId: membershipId }));
  });
}
