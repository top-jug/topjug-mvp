import 'server-only';

import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, gymPrices, gyms } from '../db/schema';
import { ApiError } from '../http/api-error';
import { auditEventValues } from '../observability/audit';
import type {
  CreateOperationsGymInput,
  ListOperationsGymsInput,
  UpdateOperationsGymInput,
  UpdateOperationsGymStatusInput,
  VerifyOperationsGymInput,
} from './operations-gym-validation';

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type GymFields = CreateOperationsGymInput | UpdateOperationsGymInput;

function gymValues(input: GymFields) {
  return {
    name: input.name,
    branchName: input.branchName,
    address: input.address,
    phone: input.phone,
    websiteUrl: input.websiteUrl,
    instagramUrl: input.instagramUrl,
    nearbyDirections: input.nearbyDirections,
    operatingHoursNote: input.operatingHoursNote,
    parkingInfo: input.parkingInfo,
    calendarColor: input.calendarColor,
    calendarTextColor: input.calendarTextColor,
    facilities: input.facilities,
  };
}

async function replacePrice(transaction: Transaction, gymId: string, type: 'day_pass' | 'shoe_rental', price: GymFields['dayPassPrice']) {
  if (!price) {
    await transaction.delete(gymPrices).where(and(eq(gymPrices.gymId, gymId), eq(gymPrices.type, type)));
    return;
  }
  await transaction.insert(gymPrices).values({
    gymId,
    type,
    amount: price.amount,
    rawText: price.rawText,
  }).onConflictDoUpdate({
    target: [gymPrices.gymId, gymPrices.type],
    set: { amount: price.amount, rawText: price.rawText, updatedAt: sql`clock_timestamp()` },
  });
}

async function lockedGym(transaction: Transaction, gymId: string, expectedUpdatedAt: string) {
  const [gym] = await transaction.select({ id: gyms.id, updatedAt: gyms.updatedAt }).from(gyms)
    .where(eq(gyms.id, gymId)).limit(1).for('update');
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
  if (gym.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new ApiError(409, 'OPS_RESOURCE_CHANGED', '다른 운영자가 암장 정보를 변경했습니다. 최신 정보를 확인해주세요.');
  }
  return gym;
}

async function loadOperationsGym(database: Database | Transaction, gymId: string) {
  const [gym] = await database.select({
    id: gyms.id,
    name: gyms.name,
    branchName: gyms.branchName,
    address: gyms.address,
    phone: gyms.phone,
    websiteUrl: gyms.websiteUrl,
    instagramUrl: gyms.instagramUrl,
    nearbyDirections: gyms.nearbyDirections,
    operatingHoursNote: gyms.operatingHoursNote,
    parkingInfo: gyms.parkingInfo,
    operationStatus: gyms.operationStatus,
    calendarColor: gyms.calendarColor,
    calendarTextColor: gyms.calendarTextColor,
    facilities: gyms.facilities,
    lastVerifiedAt: gyms.lastVerifiedAt,
    createdAt: gyms.createdAt,
    updatedAt: gyms.updatedAt,
  }).from(gyms).where(eq(gyms.id, gymId)).limit(1);
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
  const prices = await database.select({ type: gymPrices.type, amount: gymPrices.amount, rawText: gymPrices.rawText })
    .from(gymPrices).where(eq(gymPrices.gymId, gymId));
  const price = (type: 'day_pass' | 'shoe_rental') => {
    const found = prices.find((item) => item.type === type);
    return found ? { amount: found.amount, rawText: found.rawText } : null;
  };
  return { ...gym, dayPassPrice: price('day_pass'), shoeRentalPrice: price('shoe_rental') };
}

export async function listOperationsGyms(input: ListOperationsGymsInput) {
  const database = getDatabase();
  const conditions = [];
  if (input.q) conditions.push(or(
    ilike(gyms.name, `%${input.q}%`),
    ilike(gyms.branchName, `%${input.q}%`),
    ilike(gyms.address, `%${input.q}%`),
  )!);
  if (input.operationStatus) conditions.push(eq(gyms.operationStatus, input.operationStatus));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    database.select({
      id: gyms.id,
      name: gyms.name,
      branchName: gyms.branchName,
      address: gyms.address,
      operationStatus: gyms.operationStatus,
      lastVerifiedAt: gyms.lastVerifiedAt,
      updatedAt: gyms.updatedAt,
    }).from(gyms).where(where).orderBy(desc(gyms.updatedAt), desc(gyms.id))
      .limit(input.limit).offset((input.page - 1) * input.limit),
    database.select({ total: count() }).from(gyms).where(where),
  ]);
  return {
    data: rows,
    meta: { page: input.page, limit: input.limit, total, totalPages: Math.max(1, Math.ceil(total / input.limit)) },
  };
}

export async function getOperationsGym(gymId: string) {
  return loadOperationsGym(getDatabase(), gymId);
}

export async function createOperationsGym(input: CreateOperationsGymInput) {
  return getDatabase().transaction(async (transaction) => {
    const [created] = await transaction.insert(gyms).values({ ...gymValues(input), operationStatus: input.operationStatus }).returning({ id: gyms.id });
    await Promise.all([
      replacePrice(transaction, created.id, 'day_pass', input.dayPassPrice),
      replacePrice(transaction, created.id, 'shoe_rental', input.shoeRentalPrice),
    ]);
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.create', resourceType: 'gym', resourceId: created.id,
      metadata: { operationStatus: input.operationStatus },
    }));
    return loadOperationsGym(transaction, created.id);
  });
}

export async function updateOperationsGym(gymId: string, input: UpdateOperationsGymInput) {
  return getDatabase().transaction(async (transaction) => {
    await lockedGym(transaction, gymId, input.expectedUpdatedAt);
    await transaction.update(gyms).set({
      ...gymValues(input),
      updatedAt: sql`greatest(clock_timestamp(), ${gyms.updatedAt} + interval '1 millisecond')`,
    }).where(eq(gyms.id, gymId));
    await Promise.all([
      replacePrice(transaction, gymId, 'day_pass', input.dayPassPrice),
      replacePrice(transaction, gymId, 'shoe_rental', input.shoeRentalPrice),
    ]);
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.update', resourceType: 'gym', resourceId: gymId,
      metadata: { fieldCount: Object.keys(gymValues(input)).length, pricesIncluded: true },
    }));
    return loadOperationsGym(transaction, gymId);
  });
}

export async function updateOperationsGymStatus(gymId: string, input: UpdateOperationsGymStatusInput) {
  return getDatabase().transaction(async (transaction) => {
    await lockedGym(transaction, gymId, input.expectedUpdatedAt);
    await transaction.update(gyms).set({
      operationStatus: input.operationStatus,
      updatedAt: sql`greatest(clock_timestamp(), ${gyms.updatedAt} + interval '1 millisecond')`,
    }).where(eq(gyms.id, gymId));
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.operation_status.update', resourceType: 'gym', resourceId: gymId,
      metadata: { operationStatus: input.operationStatus },
    }));
    return loadOperationsGym(transaction, gymId);
  });
}

export async function verifyOperationsGym(gymId: string, input: VerifyOperationsGymInput) {
  return getDatabase().transaction(async (transaction) => {
    await lockedGym(transaction, gymId, input.expectedUpdatedAt);
    await transaction.update(gyms).set({
      lastVerifiedAt: sql`clock_timestamp()`,
      updatedAt: sql`greatest(clock_timestamp(), ${gyms.updatedAt} + interval '1 millisecond')`,
    }).where(eq(gyms.id, gymId));
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.verify', resourceType: 'gym', resourceId: gymId,
    }));
    return loadOperationsGym(transaction, gymId);
  });
}
