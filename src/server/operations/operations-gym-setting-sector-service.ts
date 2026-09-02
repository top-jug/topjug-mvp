import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, inArray, max, ne, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { databaseErrorCode } from '../db/errors';
import {
  auditEvents,
  gyms,
  gymSectors,
  gymWalls,
  recordCounts,
  settingEventSectors,
} from '../db/schema';
import { ApiError } from '../http/api-error';
import { auditEventValues } from '../observability/audit';
import type {
  CreateOperationsGymSettingSectorInput,
  DeleteOperationsGymSettingSectorInput,
  UpdateOperationsGymSettingSectorInput,
} from './operations-gym-setting-sector-validation';

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const gymSelection = {
  id: gyms.id,
  name: gyms.name,
  branchName: gyms.branchName,
  updatedAt: gyms.updatedAt,
};

async function loadGym(database: Database | Transaction, gymId: string) {
  const [gym] = await database.select(gymSelection).from(gyms).where(eq(gyms.id, gymId)).limit(1);
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
  return gym;
}

async function lockGym(transaction: Transaction, gymId: string, expectedUpdatedAt: string) {
  const [gym] = await transaction.select(gymSelection).from(gyms)
    .where(eq(gyms.id, gymId)).limit(1).for('update');
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
  if (gym.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new ApiError(409, 'OPS_RESOURCE_CHANGED', '다른 운영자가 암장 세팅 구역을 변경했습니다. 최신 정보를 확인해주세요.');
  }
  return gym;
}

async function bumpGymVersion(transaction: Transaction, gymId: string) {
  const [updated] = await transaction.update(gyms).set({
    updatedAt: sql`greatest(clock_timestamp(), ${gyms.updatedAt} + interval '1 millisecond')`,
  }).where(eq(gyms.id, gymId)).returning({ updatedAt: gyms.updatedAt });
  return updated.updatedAt;
}

async function loadSectorForMutation(transaction: Transaction, gymId: string, sectorId: string) {
  const [sector] = await transaction.select({
    id: gymSectors.id,
    name: gymSectors.name,
    wallId: gymSectors.wallId,
    wallName: gymWalls.name,
    wallIsActive: gymWalls.isActive,
  }).from(gymSectors)
    .innerJoin(gymWalls, eq(gymSectors.wallId, gymWalls.id))
    .where(and(eq(gymSectors.id, sectorId), eq(gymSectors.gymId, gymId)))
    .limit(1);
  if (!sector) throw new ApiError(404, 'OPS_GYM_SETTING_SECTOR_NOT_FOUND', '세팅 구역을 찾을 수 없습니다.');
  const [{ sectorCount }] = await transaction.select({ sectorCount: count() }).from(gymSectors)
    .where(eq(gymSectors.wallId, sector.wallId));
  return {
    ...sector,
    onlySector: sectorCount === 1,
    representsWholeWall: sectorCount === 1 && sector.name === sector.wallName,
  };
}

export async function getOperationsGymSettingSectors(gymId: string, database: Database | Transaction = getDatabase()) {
  const gym = await loadGym(database, gymId);
  const sectors = await database.select({
    id: gymSectors.id,
    name: gymSectors.name,
    sortOrder: gymSectors.sortOrder,
    isActive: gymSectors.isActive,
    createdAt: gymSectors.createdAt,
    updatedAt: gymSectors.updatedAt,
    wall: {
      id: gymWalls.id,
      name: gymWalls.name,
      sortOrder: gymWalls.sortOrder,
      isActive: gymWalls.isActive,
    },
  }).from(gymSectors)
    .innerJoin(gymWalls, eq(gymSectors.wallId, gymWalls.id))
    .where(eq(gymSectors.gymId, gymId))
    .orderBy(asc(gymWalls.sortOrder), asc(gymSectors.sortOrder), asc(gymSectors.id));
  const sectorIds = sectors.map((sector) => sector.id);
  const [eventUsage, recordUsage] = sectorIds.length > 0 ? await Promise.all([
    database.select({ id: settingEventSectors.gymSectorId, usageCount: count() })
      .from(settingEventSectors)
      .where(inArray(settingEventSectors.gymSectorId, sectorIds))
      .groupBy(settingEventSectors.gymSectorId),
    database.select({ id: recordCounts.gymSectorId, usageCount: count() })
      .from(recordCounts)
      .where(inArray(recordCounts.gymSectorId, sectorIds))
      .groupBy(recordCounts.gymSectorId),
  ]) : [[], []];
  const eventCountById = new Map(eventUsage.map((usage) => [usage.id, usage.usageCount]));
  const recordCountById = new Map(recordUsage.map((usage) => [usage.id, usage.usageCount]));
  const wallSectorCounts = new Map<string, number>();
  for (const sector of sectors) wallSectorCounts.set(sector.wall.id, (wallSectorCounts.get(sector.wall.id) ?? 0) + 1);
  return {
    gym,
    sectors: sectors.map((sector) => ({
      ...sector,
      representsWholeWall: wallSectorCounts.get(sector.wall.id) === 1 && sector.name === sector.wall.name,
      usageCount: (eventCountById.get(sector.id) ?? 0) + (recordCountById.get(sector.id) ?? 0),
    })),
  };
}

export async function createOperationsGymSettingSector(gymId: string, input: CreateOperationsGymSettingSectorInput) {
  try {
    return await getDatabase().transaction(async (transaction) => {
      await lockGym(transaction, gymId, input.expectedUpdatedAt);
      const [duplicate] = await transaction.select({ id: gymSectors.id }).from(gymSectors)
        .where(and(eq(gymSectors.gymId, gymId), sql`lower(${gymSectors.name}) = lower(${input.name})`))
        .limit(1);
      if (duplicate) throw new ApiError(409, 'OPS_GYM_SETTING_SECTOR_EXISTS', '같은 이름의 세팅 구역이 이미 있습니다.');
      const [{ lastSortOrder }] = await transaction.select({ lastSortOrder: max(gymWalls.sortOrder) })
        .from(gymWalls).where(eq(gymWalls.gymId, gymId));
      const wallId = randomUUID();
      const sectorId = randomUUID();
      await transaction.insert(gymWalls).values({
        id: wallId,
        gymId,
        code: `ops-area-${wallId}`,
        name: input.name,
        sortOrder: (lastSortOrder ?? -1) + 1,
      });
      await transaction.insert(gymSectors).values({
        id: sectorId,
        gymId,
        wallId,
        code: `whole-${sectorId}`,
        name: input.name,
        sortOrder: 0,
      });
      await bumpGymVersion(transaction, gymId);
      await transaction.insert(auditEvents).values(auditEventValues({
        action: 'ops.gym.setting_sector.create',
        resourceType: 'gym_sector',
        resourceId: sectorId,
        metadata: { gymId, name: input.name },
      }));
      return getOperationsGymSettingSectors(gymId, transaction);
    });
  } catch (error) {
    if (databaseErrorCode(error) === '23505') {
      throw new ApiError(409, 'OPS_GYM_SETTING_SECTOR_EXISTS', '같은 순서나 코드의 세팅 구역이 이미 존재합니다. 최신 정보를 확인해주세요.');
    }
    throw error;
  }
}

export async function updateOperationsGymSettingSector(
  gymId: string,
  sectorId: string,
  input: UpdateOperationsGymSettingSectorInput,
) {
  return getDatabase().transaction(async (transaction) => {
    await lockGym(transaction, gymId, input.expectedUpdatedAt);
    const sector = await loadSectorForMutation(transaction, gymId, sectorId);
    const [duplicate] = await transaction.select({ id: gymSectors.id }).from(gymSectors)
      .where(and(
        eq(gymSectors.gymId, gymId),
        ne(gymSectors.id, sectorId),
        sql`lower(${gymSectors.name}) = lower(${input.name})`,
      )).limit(1);
    if (duplicate) throw new ApiError(409, 'OPS_GYM_SETTING_SECTOR_EXISTS', '같은 이름의 세팅 구역이 이미 있습니다.');
    await transaction.update(gymSectors).set({
      name: input.name,
      isActive: input.isActive,
      updatedAt: sql`greatest(clock_timestamp(), ${gymSectors.updatedAt} + interval '1 millisecond')`,
    }).where(eq(gymSectors.id, sectorId));
    if (sector.onlySector) {
      await transaction.update(gymWalls).set({
        ...(sector.representsWholeWall ? { name: input.name } : {}),
        isActive: input.isActive,
        updatedAt: sql`greatest(clock_timestamp(), ${gymWalls.updatedAt} + interval '1 millisecond')`,
      }).where(eq(gymWalls.id, sector.wallId));
    }
    await bumpGymVersion(transaction, gymId);
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.setting_sector.update',
      resourceType: 'gym_sector',
      resourceId: sectorId,
      metadata: { gymId, name: input.name, isActive: input.isActive },
    }));
    return getOperationsGymSettingSectors(gymId, transaction);
  });
}

export async function deleteOperationsGymSettingSector(
  gymId: string,
  sectorId: string,
  input: DeleteOperationsGymSettingSectorInput,
) {
  return getDatabase().transaction(async (transaction) => {
    await lockGym(transaction, gymId, input.expectedUpdatedAt);
    const sector = await loadSectorForMutation(transaction, gymId, sectorId);
    const [[{ eventUsage }], [{ recordUsage }]] = await Promise.all([
      transaction.select({ eventUsage: count() }).from(settingEventSectors)
        .where(eq(settingEventSectors.gymSectorId, sectorId)),
      transaction.select({ recordUsage: count() }).from(recordCounts)
        .where(eq(recordCounts.gymSectorId, sectorId)),
    ]);
    const isUsed = eventUsage + recordUsage > 0;
    if (isUsed) {
      await transaction.update(gymSectors).set({
        isActive: false,
        updatedAt: sql`greatest(clock_timestamp(), ${gymSectors.updatedAt} + interval '1 millisecond')`,
      }).where(eq(gymSectors.id, sectorId));
      if (sector.onlySector) {
        await transaction.update(gymWalls).set({
          isActive: false,
          updatedAt: sql`greatest(clock_timestamp(), ${gymWalls.updatedAt} + interval '1 millisecond')`,
        }).where(eq(gymWalls.id, sector.wallId));
      }
    } else {
      await transaction.delete(gymSectors).where(eq(gymSectors.id, sectorId));
      if (sector.onlySector) await transaction.delete(gymWalls).where(eq(gymWalls.id, sector.wallId));
    }
    await bumpGymVersion(transaction, gymId);
    await transaction.insert(auditEvents).values(auditEventValues({
      action: isUsed ? 'ops.gym.setting_sector.deactivate' : 'ops.gym.setting_sector.delete',
      resourceType: 'gym_sector',
      resourceId: sectorId,
      metadata: { gymId, usageCount: eventUsage + recordUsage },
    }));
    return { mode: isUsed ? 'deactivated' as const : 'deleted' as const, ...(await getOperationsGymSettingSectors(gymId, transaction)) };
  });
}
