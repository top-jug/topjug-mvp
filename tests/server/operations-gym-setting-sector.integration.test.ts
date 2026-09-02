import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { inArray } from 'drizzle-orm';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, gyms } from '../../src/server/db/schema';
import { getGym } from '../../src/server/gyms/gym-service';
import { ApiError } from '../../src/server/http/api-error';
import {
  createOperationsGymSettingSector,
  deleteOperationsGymSettingSector,
  updateOperationsGymSettingSector,
} from '../../src/server/operations/operations-gym-setting-sector-service';
import {
  createOperationsSettingEvent,
  updateOperationsSettingEvent,
} from '../../src/server/operations/operations-setting-event-service';

test('operations setting sectors create whole-wall areas and safely deactivate referenced areas', async () => {
  const database = getDatabase();
  const suffix = randomUUID().slice(0, 8);
  const resourceIds: string[] = [];
  let gymId = '';

  try {
    const [gym] = await database.insert(gyms).values({
      name: `세팅 구역 ${suffix}`,
      address: '서울특별시 테스트로 1',
    }).returning({ id: gyms.id, updatedAt: gyms.updatedAt });
    gymId = gym.id;

    const created = await createOperationsGymSettingSector(gym.id, {
      name: 'NEW WAVE',
      expectedUpdatedAt: gym.updatedAt.toISOString(),
    });
    const area = created.sectors[0];
    resourceIds.push(area.id);
    assert.equal(area.name, 'NEW WAVE');
    assert.equal(area.wall.name, 'NEW WAVE');
    assert.equal(area.representsWholeWall, true);
    assert.equal(area.isActive, true);

    await assert.rejects(
      () => createOperationsGymSettingSector(gym.id, { name: 'STALE', expectedUpdatedAt: gym.updatedAt.toISOString() }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPS_RESOURCE_CHANGED',
    );
    await assert.rejects(
      () => createOperationsGymSettingSector(gym.id, { name: 'new wave', expectedUpdatedAt: created.gym.updatedAt.toISOString() }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPS_GYM_SETTING_SECTOR_EXISTS',
    );

    const renamed = await updateOperationsGymSettingSector(gym.id, area.id, {
      name: 'WHITE WALL',
      isActive: true,
      expectedUpdatedAt: created.gym.updatedAt.toISOString(),
    });
    assert.equal(renamed.sectors[0].name, 'WHITE WALL');
    assert.equal(renamed.sectors[0].wall.name, 'WHITE WALL');
    const publicGym = await getGym(gym.id);
    assert.equal(publicGym.walls[0].name, 'WHITE WALL');
    assert.equal(publicGym.walls[0].sectors[0].name, 'WHITE WALL');

    const secondCreated = await createOperationsGymSettingSector(gym.id, {
      name: 'ARCH',
      expectedUpdatedAt: renamed.gym.updatedAt.toISOString(),
    });
    const arch = secondCreated.sectors.find((sector) => sector.name === 'ARCH')!;
    resourceIds.push(arch.id);

    const settingEvent = await createOperationsSettingEvent({
      gymId: gym.id,
      title: '정기 세팅',
      startsAt: '2026-09-10T01:00:00Z',
      endsAt: '2026-09-10T04:00:00Z',
      note: null,
      sectorIds: [area.id, arch.id],
    });
    resourceIds.push(settingEvent.id);

    const deactivated = await deleteOperationsGymSettingSector(gym.id, area.id, {
      expectedUpdatedAt: secondCreated.gym.updatedAt.toISOString(),
    });
    assert.equal(deactivated.mode, 'deactivated');
    assert.equal(deactivated.sectors[0].isActive, false);
    assert.equal(deactivated.sectors[0].wall.isActive, false);
    await assert.rejects(
      () => createOperationsSettingEvent({
        gymId: gym.id,
        title: '비활성 구역 신규 일정',
        startsAt: '2026-09-11T01:00:00Z',
        endsAt: null,
        note: null,
        sectorIds: [area.id],
      }),
      (error: unknown) => error instanceof ApiError && error.code === 'SETTING_EVENT_SECTOR_GYM_MISMATCH',
    );
    const preserved = await updateOperationsSettingEvent(settingEvent.id, {
      title: '기존 일정 이름 수정',
      sectorIds: [area.id, arch.id],
      expectedUpdatedAt: settingEvent.updatedAt.toISOString(),
    });
    assert.deepEqual(new Set(preserved.sectors.map((sector) => sector.id)), new Set([area.id, arch.id]));

    const restored = await updateOperationsGymSettingSector(gym.id, area.id, {
      name: 'WHITE WALL',
      isActive: true,
      expectedUpdatedAt: deactivated.gym.updatedAt.toISOString(),
    });
    const unusedCreated = await createOperationsGymSettingSector(gym.id, {
      name: 'UNUSED',
      expectedUpdatedAt: restored.gym.updatedAt.toISOString(),
    });
    const unused = unusedCreated.sectors.find((sector) => sector.name === 'UNUSED')!;
    resourceIds.push(unused.id);
    const deleted = await deleteOperationsGymSettingSector(gym.id, unused.id, {
      expectedUpdatedAt: unusedCreated.gym.updatedAt.toISOString(),
    });
    assert.equal(deleted.mode, 'deleted');
    assert.equal(deleted.sectors.some((sector) => sector.id === unused.id), false);
  } finally {
    if (resourceIds.length > 0) await database.delete(auditEvents).where(inArray(auditEvents.resourceId, resourceIds));
    if (gymId) await database.delete(gyms).where(inArray(gyms.id, [gymId]));
    await closeDatabase();
  }
});
