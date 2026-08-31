import 'server-only';

import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, gymOperatingHourOverrides, gymOperatingHours, gyms } from '../db/schema';
import { ApiError } from '../http/api-error';
import { auditEventValues } from '../observability/audit';
import type {
  BatchOperatingHourOverridesInput,
  DeleteOperatingHourOverrideInput,
  CreateOperatingHourOverrideInput,
  ReplaceWeeklyOperatingHoursInput,
} from './operations-gym-validation';

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type DatabaseExecutor = Database | Transaction;
type Schedule = { isClosed: boolean; intervals: Array<{ opensAt: string; closesAt: string }> };

async function lockGym(transaction: Transaction, gymId: string, expectedUpdatedAt: string) {
  const [gym] = await transaction.select({ id: gyms.id, updatedAt: gyms.updatedAt }).from(gyms)
    .where(eq(gyms.id, gymId)).limit(1).for('update');
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
  if (gym.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new ApiError(409, 'OPS_RESOURCE_CHANGED', '다른 운영자가 암장 정보를 변경했습니다. 최신 정보를 확인해주세요.');
  }
}

async function touchGym(transaction: Transaction, gymId: string) {
  await transaction.update(gyms).set({
    updatedAt: sql`greatest(clock_timestamp(), ${gyms.updatedAt} + interval '1 millisecond')`,
  }).where(eq(gyms.id, gymId));
}

function scheduleRows(schedule: Schedule) {
  if (schedule.isClosed) return [{ sequence: 0, opensAt: null, closesAt: null, isClosed: true }];
  return schedule.intervals.map((interval, sequence) => ({ ...interval, sequence, isClosed: false }));
}

function dateStrings(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function loadOperationsGymHours(database: DatabaseExecutor, gymId: string) {
  const [gym] = await database.select({ updatedAt: gyms.updatedAt }).from(gyms).where(eq(gyms.id, gymId)).limit(1);
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
  const [operatingHours, operatingHourOverrides] = await Promise.all([
    database.select({
      dayOfWeek: gymOperatingHours.dayOfWeek,
      sequence: gymOperatingHours.sequence,
      opensAt: gymOperatingHours.opensAt,
      closesAt: gymOperatingHours.closesAt,
      isClosed: gymOperatingHours.isClosed,
    }).from(gymOperatingHours).where(eq(gymOperatingHours.gymId, gymId))
      .orderBy(asc(gymOperatingHours.dayOfWeek), asc(gymOperatingHours.sequence)),
    database.select({
      date: gymOperatingHourOverrides.date,
      sequence: gymOperatingHourOverrides.sequence,
      opensAt: gymOperatingHourOverrides.opensAt,
      closesAt: gymOperatingHourOverrides.closesAt,
      isClosed: gymOperatingHourOverrides.isClosed,
      note: gymOperatingHourOverrides.note,
    }).from(gymOperatingHourOverrides).where(eq(gymOperatingHourOverrides.gymId, gymId))
      .orderBy(asc(gymOperatingHourOverrides.date), asc(gymOperatingHourOverrides.sequence)),
  ]);
  return { updatedAt: gym.updatedAt, operatingHours, operatingHourOverrides };
}

export async function replaceWeeklyOperatingHours(gymId: string, input: ReplaceWeeklyOperatingHoursInput) {
  return getDatabase().transaction(async (transaction) => {
    await lockGym(transaction, gymId, input.expectedUpdatedAt);
    await transaction.delete(gymOperatingHours).where(eq(gymOperatingHours.gymId, gymId));
    const rows = input.days.flatMap((day) => scheduleRows(day).map((row) => ({
      gymId,
      dayOfWeek: day.dayOfWeek,
      ...row,
    })));
    await transaction.insert(gymOperatingHours).values(rows);
    await touchGym(transaction, gymId);
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.hours.update',
      resourceType: 'gym',
      resourceId: gymId,
      metadata: { scope: 'weekly', dayCount: input.days.length, intervalCount: rows.filter((row) => !row.isClosed).length },
    }));
    return loadOperationsGymHours(transaction, gymId);
  });
}

export async function createOperatingHourOverride(
  gymId: string,
  date: string,
  input: CreateOperatingHourOverrideInput,
) {
  return getDatabase().transaction(async (transaction) => {
    await lockGym(transaction, gymId, input.expectedUpdatedAt);
    const [existing] = await transaction.select({ id: gymOperatingHourOverrides.id })
      .from(gymOperatingHourOverrides).where(and(
      eq(gymOperatingHourOverrides.gymId, gymId),
      eq(gymOperatingHourOverrides.date, date),
    )).limit(1);
    if (existing) {
      throw new ApiError(409, 'OPERATING_HOUR_OVERRIDE_EXISTS', '이미 예외 운영시간이 등록된 날짜입니다. 기존 예외를 삭제한 뒤 다시 등록해주세요.');
    }
    const rows = scheduleRows(input).map((row) => ({ gymId, date, note: input.note, ...row }));
    await transaction.insert(gymOperatingHourOverrides).values(rows);
    await touchGym(transaction, gymId);
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.hours.update',
      resourceType: 'gym',
      resourceId: gymId,
      metadata: { scope: 'date_override', date, intervalCount: rows.filter((row) => !row.isClosed).length },
    }));
    return loadOperationsGymHours(transaction, gymId);
  });
}

export async function deleteOperatingHourOverride(
  gymId: string,
  date: string,
  input: DeleteOperatingHourOverrideInput,
) {
  return getDatabase().transaction(async (transaction) => {
    await lockGym(transaction, gymId, input.expectedUpdatedAt);
    await transaction.delete(gymOperatingHourOverrides).where(and(
      eq(gymOperatingHourOverrides.gymId, gymId),
      eq(gymOperatingHourOverrides.date, date),
    ));
    await touchGym(transaction, gymId);
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.hours.update',
      resourceType: 'gym',
      resourceId: gymId,
      metadata: { scope: 'date_override_delete', date },
    }));
    return loadOperationsGymHours(transaction, gymId);
  });
}

export async function batchOperatingHourOverrides(gymId: string, input: BatchOperatingHourOverridesInput) {
  return getDatabase().transaction(async (transaction) => {
    await lockGym(transaction, gymId, input.expectedUpdatedAt);
    const existing = await transaction.selectDistinct({ date: gymOperatingHourOverrides.date })
      .from(gymOperatingHourOverrides)
      .where(and(
        eq(gymOperatingHourOverrides.gymId, gymId),
        gte(gymOperatingHourOverrides.date, input.startDate),
        lte(gymOperatingHourOverrides.date, input.endDate),
      ))
      .orderBy(asc(gymOperatingHourOverrides.date));
    if (existing.length > 0 && !input.overwriteExisting) {
      const dates = existing.map((row) => row.date);
      const preview = dates.slice(0, 8).join(', ');
      const remainder = dates.length > 8 ? ` 외 ${dates.length - 8}일` : '';
      throw new ApiError(409, 'OPERATING_HOUR_OVERRIDE_EXISTS', `이미 예외 운영시간이 있는 날짜입니다: ${preview}${remainder}`);
    }

    await transaction.delete(gymOperatingHourOverrides).where(and(
      eq(gymOperatingHourOverrides.gymId, gymId),
      gte(gymOperatingHourOverrides.date, input.startDate),
      lte(gymOperatingHourOverrides.date, input.endDate),
    ));
    const dates = dateStrings(input.startDate, input.endDate);
    const rows = dates.flatMap((date) => scheduleRows(input).map((row) => ({ gymId, date, note: input.note, ...row })));
    await transaction.insert(gymOperatingHourOverrides).values(rows);
    await touchGym(transaction, gymId);
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.hours.update',
      resourceType: 'gym',
      resourceId: gymId,
      metadata: {
        scope: 'override_batch',
        dateCount: dates.length,
        intervalCount: rows.filter((row) => !row.isClosed).length,
        overwriteExisting: input.overwriteExisting,
      },
    }));
    return loadOperationsGymHours(transaction, gymId);
  });
}
