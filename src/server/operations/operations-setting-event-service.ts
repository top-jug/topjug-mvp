import 'server-only';

import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, gyms, gymSectors, gymWalls, settingEvents, settingEventSectors } from '../db/schema';
import { ApiError } from '../http/api-error';
import { auditEventValues } from '../observability/audit';
import type {
  CreateOperationsSettingEventInput,
  DeleteOperationsSettingEventInput,
  ListOperationsSettingEventsInput,
  UpdateOperationsSettingEventInput,
} from './operations-setting-event-validation';

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type SettingEventStatus = 'scheduled' | 'completed' | 'cancelled';

const operationsSettingEventSelection = {
  id: settingEvents.id,
  gymId: settingEvents.gymId,
  title: settingEvents.title,
  status: settingEvents.status,
  startsAt: settingEvents.startsAt,
  endsAt: settingEvents.endsAt,
  note: settingEvents.note,
  createdAt: settingEvents.createdAt,
  updatedAt: settingEvents.updatedAt,
  gym: {
    id: gyms.id,
    name: gyms.name,
    branchName: gyms.branchName,
  },
};

const operationsSettingEventSectorSelection = {
  settingEventId: settingEventSectors.settingEventId,
  id: gymSectors.id,
  code: gymSectors.code,
  name: gymSectors.name,
  sortOrder: gymSectors.sortOrder,
  isActive: gymSectors.isActive,
  wall: {
    id: gymWalls.id,
    code: gymWalls.code,
    name: gymWalls.name,
  },
};

async function loadSectors(database: Database | Transaction, eventIds: string[]) {
  if (eventIds.length === 0) return [];
  return database.select(operationsSettingEventSectorSelection)
    .from(settingEventSectors)
    .innerJoin(gymSectors, eq(settingEventSectors.gymSectorId, gymSectors.id))
    .innerJoin(gymWalls, eq(gymSectors.wallId, gymWalls.id))
    .where(inArray(settingEventSectors.settingEventId, eventIds))
    .orderBy(asc(gymWalls.sortOrder), asc(gymSectors.sortOrder), asc(gymSectors.id));
}

export async function getOperationsSettingEvent(eventId: string) {
  return loadOperationsSettingEvent(getDatabase(), eventId);
}

async function loadOperationsSettingEvent(database: Database | Transaction, eventId: string) {
  const [event] = await database.select(operationsSettingEventSelection)
    .from(settingEvents)
    .innerJoin(gyms, eq(settingEvents.gymId, gyms.id))
    .where(and(eq(settingEvents.id, eventId), isNull(settingEvents.deletedAt)))
    .limit(1);
  if (!event) throw new ApiError(404, 'SETTING_EVENT_NOT_FOUND', '세팅 일정을 찾을 수 없습니다.');
  const sectors = await loadSectors(database, [event.id]);
  return { ...event, sectors: sectors.map(({ settingEventId: _, ...sector }) => sector) };
}

export async function listOperationsSettingEvents(input: ListOperationsSettingEventsInput) {
  const database = getDatabase();
  const conditions = [
    isNull(settingEvents.deletedAt),
    lte(settingEvents.startsAt, new Date(input.to)),
    or(
      gte(settingEvents.endsAt, new Date(input.from)),
      and(isNull(settingEvents.endsAt), gte(settingEvents.startsAt, new Date(input.from))),
    )!,
  ];
  if (input.gymId) conditions.push(eq(settingEvents.gymId, input.gymId));
  if (input.status) conditions.push(eq(settingEvents.status, input.status));

  const events = await database.select(operationsSettingEventSelection)
    .from(settingEvents)
    .innerJoin(gyms, eq(settingEvents.gymId, gyms.id))
    .where(and(...conditions))
    .orderBy(asc(settingEvents.startsAt), asc(gyms.name), asc(settingEvents.id));
  const sectors = await loadSectors(database, events.map((event) => event.id));
  const sectorsByEvent = new Map<string, Array<Omit<(typeof sectors)[number], 'settingEventId'>>>();
  for (const { settingEventId, ...sector } of sectors) {
    sectorsByEvent.set(settingEventId, [...(sectorsByEvent.get(settingEventId) ?? []), sector]);
  }
  return events.map((event) => ({ ...event, sectors: sectorsByEvent.get(event.id) ?? [] }));
}

async function ensureGymExists(database: Database | Transaction, gymId: string) {
  const [gym] = await database.select({ id: gyms.id }).from(gyms).where(eq(gyms.id, gymId)).limit(1);
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
}

async function ensureSectorsBelongToGym(database: Database | Transaction, gymId: string, sectorIds: string[]) {
  const sectors = await database.select({ id: gymSectors.id }).from(gymSectors)
    .where(and(eq(gymSectors.gymId, gymId), inArray(gymSectors.id, sectorIds)));
  if (sectors.length !== sectorIds.length) {
    throw new ApiError(400, 'SETTING_EVENT_SECTOR_GYM_MISMATCH', '선택한 섹터가 세팅 일정의 암장에 속하지 않습니다.');
  }
}

async function lockSettingEvent(transaction: Transaction, eventId: string, expectedUpdatedAt: string) {
  const [event] = await transaction.select({
    id: settingEvents.id,
    gymId: settingEvents.gymId,
    status: settingEvents.status,
    startsAt: settingEvents.startsAt,
    endsAt: settingEvents.endsAt,
    updatedAt: settingEvents.updatedAt,
  }).from(settingEvents)
    .where(and(eq(settingEvents.id, eventId), isNull(settingEvents.deletedAt)))
    .limit(1)
    .for('update');
  if (!event) throw new ApiError(404, 'SETTING_EVENT_NOT_FOUND', '세팅 일정을 찾을 수 없습니다.');
  if (event.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new ApiError(409, 'OPS_RESOURCE_CHANGED', '다른 운영자가 세팅 일정을 변경했습니다. 최신 정보를 확인해주세요.');
  }
  return event;
}

function ensureValidTransition(current: SettingEventStatus, next: SettingEventStatus) {
  if (current !== 'scheduled' && next !== current) {
    throw new ApiError(409, 'INVALID_SETTING_EVENT_TRANSITION', '완료되거나 취소된 세팅 일정의 상태는 되돌릴 수 없습니다.');
  }
}

function ensureValidTimeRange(startsAt: Date, endsAt: Date | null) {
  if (endsAt && endsAt < startsAt) {
    throw new ApiError(400, 'INVALID_SETTING_EVENT_TIME_RANGE', '종료 시각은 시작 시각보다 빠를 수 없습니다.');
  }
}

export async function createOperationsSettingEvent(input: CreateOperationsSettingEventInput) {
  return getDatabase().transaction(async (transaction) => {
    await ensureGymExists(transaction, input.gymId);
    await ensureSectorsBelongToGym(transaction, input.gymId, input.sectorIds);
    const [created] = await transaction.insert(settingEvents).values({
      gymId: input.gymId,
      title: input.title,
      status: 'scheduled',
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      note: input.note,
    }).returning({ id: settingEvents.id });
    await transaction.insert(settingEventSectors).values(input.sectorIds.map((gymSectorId) => ({
      settingEventId: created.id,
      gymSectorId,
      gymId: input.gymId,
    })));
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.setting_event.create',
      resourceType: 'setting_event',
      resourceId: created.id,
      metadata: { status: 'scheduled', sectorCount: input.sectorIds.length },
    }));
    return loadOperationsSettingEvent(transaction, created.id);
  });
}

export async function updateOperationsSettingEvent(eventId: string, input: UpdateOperationsSettingEventInput) {
  return getDatabase().transaction(async (transaction) => {
    const event = await lockSettingEvent(transaction, eventId, input.expectedUpdatedAt);
    const nextStatus = input.status ?? event.status;
    ensureValidTransition(event.status, nextStatus);
    const nextStartsAt = input.startsAt ? new Date(input.startsAt) : event.startsAt;
    const nextEndsAt = input.endsAt !== undefined
      ? input.endsAt ? new Date(input.endsAt) : null
      : event.endsAt;
    ensureValidTimeRange(nextStartsAt, nextEndsAt);

    if (input.sectorIds) {
      await ensureSectorsBelongToGym(transaction, event.gymId, input.sectorIds);
      await transaction.delete(settingEventSectors).where(eq(settingEventSectors.settingEventId, eventId));
      await transaction.insert(settingEventSectors).values(input.sectorIds.map((gymSectorId) => ({
        settingEventId: eventId,
        gymSectorId,
        gymId: event.gymId,
      })));
    }

    await transaction.update(settingEvents).set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startsAt !== undefined ? { startsAt: nextStartsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: nextEndsAt } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      updatedAt: sql`greatest(clock_timestamp(), ${settingEvents.updatedAt} + interval '1 millisecond')`,
    }).where(eq(settingEvents.id, eventId));
    const changedFields = Object.keys(input).filter((key) => key !== 'expectedUpdatedAt').sort().join(',');
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.setting_event.update',
      resourceType: 'setting_event',
      resourceId: eventId,
      metadata: { fromStatus: event.status, toStatus: nextStatus, changedFields },
    }));
    return loadOperationsSettingEvent(transaction, eventId);
  });
}

export async function deleteOperationsSettingEvent(eventId: string, input: DeleteOperationsSettingEventInput) {
  await getDatabase().transaction(async (transaction) => {
    const event = await lockSettingEvent(transaction, eventId, input.expectedUpdatedAt);
    await transaction.update(settingEvents).set({
      deletedAt: sql`clock_timestamp()`,
      updatedAt: sql`greatest(clock_timestamp(), ${settingEvents.updatedAt} + interval '1 millisecond')`,
    }).where(eq(settingEvents.id, eventId));
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.setting_event.delete',
      resourceType: 'setting_event',
      resourceId: eventId,
      metadata: { status: event.status },
    }));
  });
}
