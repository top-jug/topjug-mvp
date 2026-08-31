import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, gymOperatingHourOverrides, gymOperatingHours, gyms } from '../../src/server/db/schema';
import { getGym, listGyms } from '../../src/server/gyms/gym-service';
import { ApiError } from '../../src/server/http/api-error';
import {
  createOperationsGym,
  listOperationsGyms,
  updateOperationsGym,
  updateOperationsGymStatus,
  verifyOperationsGym,
} from '../../src/server/operations/operations-gym-service';
import {
  batchOperatingHourOverrides,
  deleteOperatingHourOverride,
  createOperatingHourOverride,
  replaceWeeklyOperatingHours,
} from '../../src/server/operations/operations-gym-hours-service';

const baseInput = (suffix: string) => ({
  name: `운영 암장 ${suffix}`,
  branchName: null,
  address: '서울특별시 종로구 테스트로 1',
  phone: null,
  websiteUrl: 'https://example.com',
  instagramUrl: null,
  nearbyDirections: null,
  operatingHoursNote: '평일 10:00-22:00',
  parkingInfo: null,
  calendarColor: '#2563eb',
  calendarTextColor: '#ffffff',
  facilities: ['샤워실', '주차'],
  dayPassPrice: { amount: 20000, rawText: '20,000원' },
  shoeRentalPrice: null,
});

test('operations gym workflow records versions, verification time, and audits', async () => {
  const database = getDatabase();
  const suffix = randomUUID();
  const gymIds: string[] = [];

  try {
    const created = await createOperationsGym({ ...baseInput(suffix), operationStatus: 'active' });
    gymIds.push(created.id);
    assert.equal(created.lastVerifiedAt, null);
    assert.equal(created.dayPassPrice?.amount, 20000);
    assert.deepEqual(Object.keys(created.dayPassPrice ?? {}).sort(), ['amount', 'rawText']);

    const page = await listOperationsGyms({ q: suffix, page: 1, limit: 20 });
    assert.deepEqual(page.data.map((gym) => gym.id), [created.id]);
    assert.equal(page.meta.total, 1);

    const updated = await updateOperationsGym(created.id, {
      ...baseInput(suffix),
      phone: '02-1234-5678',
      expectedUpdatedAt: created.updatedAt.toISOString(),
    });
    assert.equal(updated.phone, '02-1234-5678');
    assert.ok(updated.updatedAt > created.updatedAt);
    assert.equal(updated.lastVerifiedAt, null);

    await assert.rejects(
      () => updateOperationsGym(created.id, { ...baseInput(suffix), expectedUpdatedAt: created.updatedAt.toISOString() }),
      (error: unknown) => error instanceof ApiError && error.status === 409 && error.code === 'OPS_RESOURCE_CHANGED',
    );

    const statusUpdated = await updateOperationsGymStatus(created.id, {
      operationStatus: 'temporarily_closed',
      expectedUpdatedAt: updated.updatedAt.toISOString(),
    });
    assert.equal(statusUpdated.operationStatus, 'temporarily_closed');

    const verified = await verifyOperationsGym(created.id, { expectedUpdatedAt: statusUpdated.updatedAt.toISOString() });
    assert.ok(verified.lastVerifiedAt instanceof Date);
    assert.ok(verified.updatedAt > statusUpdated.updatedAt);

    const [closed] = await database.insert(gyms).values({
      name: `폐업 암장 ${suffix}`,
      address: '서울특별시 테스트로 2',
      operationStatus: 'closed',
    }).returning({ id: gyms.id });
    gymIds.push(closed.id);
    const publicResults = await listGyms({ q: suffix, facility: [], limit: 50 });
    assert.deepEqual(publicResults.data.map((gym) => gym.id), [created.id]);

    const audits = await database.select({ action: auditEvents.action }).from(auditEvents)
      .where(eq(auditEvents.resourceId, created.id));
    assert.deepEqual(audits.map((audit) => audit.action).sort(), [
      'ops.gym.create',
      'ops.gym.operation_status.update',
      'ops.gym.update',
      'ops.gym.verify',
    ]);
  } finally {
    if (gymIds.length > 0) {
      await database.delete(auditEvents).where(inArray(auditEvents.resourceId, gymIds));
      await database.delete(gyms).where(inArray(gyms.id, gymIds));
    }
    await closeDatabase();
  }
});

test('operations hours replace schedules transactionally and require explicit batch overwrite', async () => {
  const database = getDatabase();
  const created = await createOperationsGym({ ...baseInput(randomUUID()), operationStatus: 'active' });
  try {
    const days = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      isClosed: dayOfWeek === 0,
      intervals: dayOfWeek === 0 ? [] : [
        { opensAt: '10:00:00', closesAt: '14:00:00' },
        { opensAt: '16:00:00', closesAt: '22:00:00' },
      ],
    }));
    const weekly = await replaceWeeklyOperatingHours(created.id, {
      days,
      expectedUpdatedAt: created.updatedAt.toISOString(),
    });
    assert.equal(weekly.operatingHours.length, 13);
    await assert.rejects(
      () => replaceWeeklyOperatingHours(created.id, { days, expectedUpdatedAt: created.updatedAt.toISOString() }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPS_RESOURCE_CHANGED',
    );

    const single = await createOperatingHourOverride(created.id, '2026-09-01', {
      isClosed: false,
      intervals: [{ opensAt: '12:00:00', closesAt: '18:00:00' }],
      note: '단축 운영',
      expectedUpdatedAt: weekly.updatedAt.toISOString(),
    });
    await assert.rejects(
      () => createOperatingHourOverride(created.id, '2026-09-01', {
        isClosed: true,
        intervals: [],
        note: '임시 휴무',
        expectedUpdatedAt: single.updatedAt.toISOString(),
      }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPERATING_HOUR_OVERRIDE_EXISTS',
    );
    await assert.rejects(
      () => batchOperatingHourOverrides(created.id, {
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        isClosed: true,
        intervals: [],
        note: '시설 점검',
        overwriteExisting: false,
        expectedUpdatedAt: single.updatedAt.toISOString(),
      }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPERATING_HOUR_OVERRIDE_EXISTS',
    );

    const batch = await batchOperatingHourOverrides(created.id, {
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      isClosed: true,
      intervals: [],
      note: '시설 점검',
      overwriteExisting: true,
      expectedUpdatedAt: single.updatedAt.toISOString(),
    });
    assert.equal(batch.operatingHourOverrides.length, 3);
    assert.ok(batch.operatingHourOverrides.every((row) => row.isClosed));
    await assert.rejects(
      () => createOperatingHourOverride(created.id, '2026-09-01', {
        isClosed: false,
        intervals: [{ opensAt: '12:00:00', closesAt: '18:00:00' }],
        note: '단축 운영',
        expectedUpdatedAt: batch.updatedAt.toISOString(),
      }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPERATING_HOUR_OVERRIDE_EXISTS',
    );

    const deleted = await deleteOperatingHourOverride(created.id, '2026-09-02', {
      expectedUpdatedAt: batch.updatedAt.toISOString(),
    });
    assert.deepEqual(deleted.operatingHourOverrides.map((row) => row.date), ['2026-09-01', '2026-09-03']);

    const publicGym = await getGym(created.id);
    assert.equal(publicGym.operatingHours.length, 13);
    assert.deepEqual(publicGym.operatingHourOverrides.map((row) => row.date), ['2026-09-01', '2026-09-03']);
    assert.ok(publicGym.operatingHourOverrides.every((row) => row.isClosed));

    const audits = await database.select({ action: auditEvents.action }).from(auditEvents)
      .where(eq(auditEvents.resourceId, created.id));
    assert.equal(audits.filter((audit) => audit.action === 'ops.gym.hours.update').length, 4);
  } finally {
    await database.delete(auditEvents).where(eq(auditEvents.resourceId, created.id));
    await database.delete(gymOperatingHourOverrides).where(eq(gymOperatingHourOverrides.gymId, created.id));
    await database.delete(gymOperatingHours).where(eq(gymOperatingHours.gymId, created.id));
    await database.delete(gyms).where(eq(gyms.id, created.id));
    await closeDatabase();
  }
});
