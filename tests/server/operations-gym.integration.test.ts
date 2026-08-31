import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, gyms } from '../../src/server/db/schema';
import { listGyms } from '../../src/server/gyms/gym-service';
import { ApiError } from '../../src/server/http/api-error';
import {
  createOperationsGym,
  listOperationsGyms,
  updateOperationsGym,
  updateOperationsGymStatus,
  verifyOperationsGym,
} from '../../src/server/operations/operations-gym-service';

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
    const publicResults = await listGyms({ q: suffix, facility: [], tag: [], limit: 50 });
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
