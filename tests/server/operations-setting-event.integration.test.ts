import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { listSettingEvents } from '../../src/server/calendar/setting-event-service';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, gyms, gymSectors, gymWalls, settingEvents } from '../../src/server/db/schema';
import { getGym } from '../../src/server/gyms/gym-service';
import { ApiError } from '../../src/server/http/api-error';
import {
  createOperationsSettingEvent,
  deleteOperationsSettingEvent,
  getOperationsSettingEvent,
  listOperationsSettingEvents,
  updateOperationsSettingEvent,
} from '../../src/server/operations/operations-setting-event-service';

test('operations setting events enforce ownership, versions, lifecycle, audits, and soft deletion', async () => {
  const database = getDatabase();
  const suffix = randomUUID().slice(0, 8);
  const gymIds: string[] = [];
  const eventIds: string[] = [];

  try {
    const [targetGym, otherGym] = await database.insert(gyms).values([
      { name: `세팅 대상 ${suffix}`, address: '서울특별시 테스트로 1' },
      { name: `세팅 다른 암장 ${suffix}`, address: '서울특별시 테스트로 2' },
    ]).returning({ id: gyms.id });
    gymIds.push(targetGym.id, otherGym.id);
    const [targetWall, otherWall] = await database.insert(gymWalls).values([
      { gymId: targetGym.id, code: `target_${suffix}`, name: '대상 벽' },
      { gymId: otherGym.id, code: `other_${suffix}`, name: '다른 벽' },
    ]).returning({ id: gymWalls.id, gymId: gymWalls.gymId });
    const [targetSector, otherSector] = await database.insert(gymSectors).values([
      { gymId: targetGym.id, wallId: targetWall.id, code: `target_${suffix}`, name: '대상 섹터' },
      { gymId: otherGym.id, wallId: otherWall.id, code: `other_${suffix}`, name: '다른 섹터' },
    ]).returning({ id: gymSectors.id });

    const baseInput = {
      gymId: targetGym.id,
      title: 'A벽 정기 세팅',
      startsAt: '2026-09-10T01:00:00Z',
      endsAt: '2026-09-10T04:00:00Z',
      note: '오전 작업',
    };
    await assert.rejects(
      () => createOperationsSettingEvent({ ...baseInput, sectorIds: [targetSector.id, otherSector.id] }),
      (error: unknown) => error instanceof ApiError && error.code === 'SETTING_EVENT_SECTOR_GYM_MISMATCH',
    );

    const created = await createOperationsSettingEvent({ ...baseInput, sectorIds: [targetSector.id] });
    eventIds.push(created.id);
    assert.equal(created.status, 'scheduled');
    assert.deepEqual(created.sectors.map((sector) => sector.id), [targetSector.id]);
    assert.deepEqual((await listOperationsSettingEvents({
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-30T23:59:59Z',
      gymId: targetGym.id,
    })).map((event) => event.id), [created.id]);

    const updated = await updateOperationsSettingEvent(created.id, {
      title: 'A벽 정기 세팅 수정',
      expectedUpdatedAt: created.updatedAt.toISOString(),
    });
    assert.ok(updated.updatedAt > created.updatedAt);
    await assert.rejects(
      () => updateOperationsSettingEvent(created.id, {
        note: '오래된 요청',
        expectedUpdatedAt: created.updatedAt.toISOString(),
      }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPS_RESOURCE_CHANGED',
    );

    const completed = await updateOperationsSettingEvent(created.id, {
      status: 'completed',
      expectedUpdatedAt: updated.updatedAt.toISOString(),
    });
    await assert.rejects(
      () => updateOperationsSettingEvent(created.id, {
        status: 'scheduled',
        expectedUpdatedAt: completed.updatedAt.toISOString(),
      }),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_SETTING_EVENT_TRANSITION',
    );

    await deleteOperationsSettingEvent(created.id, { expectedUpdatedAt: completed.updatedAt.toISOString() });
    await assert.rejects(
      () => getOperationsSettingEvent(created.id),
      (error: unknown) => error instanceof ApiError && error.code === 'SETTING_EVENT_NOT_FOUND',
    );
    assert.deepEqual(await listOperationsSettingEvents({
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-30T23:59:59Z',
      gymId: targetGym.id,
    }), []);
    assert.deepEqual((await listSettingEvents({
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-30T23:59:59Z',
      gymId: targetGym.id,
    })).data, []);
    assert.deepEqual((await getGym(targetGym.id)).settingEvents, []);

    const [deleted] = await database.select({ deletedAt: settingEvents.deletedAt })
      .from(settingEvents).where(eq(settingEvents.id, created.id));
    assert.ok(deleted.deletedAt instanceof Date);
    const audits = await database.select({ action: auditEvents.action }).from(auditEvents)
      .where(eq(auditEvents.resourceId, created.id));
    assert.deepEqual(audits.map((audit) => audit.action).sort(), [
      'ops.setting_event.create',
      'ops.setting_event.delete',
      'ops.setting_event.update',
      'ops.setting_event.update',
    ]);
  } finally {
    if (eventIds.length > 0) await database.delete(auditEvents).where(inArray(auditEvents.resourceId, eventIds));
    if (gymIds.length > 0) await database.delete(gyms).where(inArray(gyms.id, gymIds));
    await closeDatabase();
  }
});
