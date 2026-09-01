import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { inArray } from 'drizzle-orm';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, gyms, gymTags } from '../../src/server/db/schema';
import { listActiveGymTags } from '../../src/server/gyms/gym-tag-service';
import { listGyms } from '../../src/server/gyms/gym-service';
import { ApiError } from '../../src/server/http/api-error';
import {
  createOperationsGymTag,
  deleteOperationsGymTag,
  listOperationsGymTags,
  replaceOperationsGymTags,
  updateOperationsGymTag,
} from '../../src/server/operations/operations-gym-tag-service';

test('operations keywords support activation, safe assignment, and public AND search', async () => {
  const database = getDatabase();
  const suffix = randomUUID().slice(0, 8);
  const resourceIds: string[] = [];
  const gymIds: string[] = [];
  const tagIds: string[] = [];

  try {
    const [targetGym, decoyGym] = await database.insert(gyms).values([
      { name: `키워드 대상 ${suffix}`, address: '서울특별시 테스트로 1' },
      { name: `키워드 미끼 ${suffix}`, address: '서울특별시 테스트로 2' },
    ]).returning({ id: gyms.id, updatedAt: gyms.updatedAt });
    gymIds.push(targetGym.id, decoyGym.id);
    resourceIds.push(targetGym.id, decoyGym.id);

    const shower = await createOperationsGymTag({ code: `shower_${suffix}`, label: `샤워 ${suffix}`, description: null, sortOrder: 10, isActive: true });
    const parking = await createOperationsGymTag({ code: `parking_${suffix}`, label: `주차 ${suffix}`, description: null, sortOrder: 20, isActive: true });
    const hidden = await createOperationsGymTag({ code: `hidden_${suffix}`, label: `비활성 ${suffix}`, description: null, sortOrder: 30, isActive: false });
    tagIds.push(shower.id, parking.id, hidden.id);
    resourceIds.push(shower.id, parking.id, hidden.id);

    const targetAssignment = await replaceOperationsGymTags(targetGym.id, {
      tagIds: [shower.id, parking.id],
      expectedUpdatedAt: targetGym.updatedAt.toISOString(),
    });
    await replaceOperationsGymTags(decoyGym.id, {
      tagIds: [shower.id],
      expectedUpdatedAt: decoyGym.updatedAt.toISOString(),
    });

    const operationsTags = await listOperationsGymTags();
    assert.equal(operationsTags.find((tag) => tag.id === shower.id)?.assignmentCount, 2);
    assert.equal(operationsTags.find((tag) => tag.id === parking.id)?.assignmentCount, 1);

    const publicResults = await listGyms({
      q: suffix,
      facility: [],
      tag: [shower.code, parking.code],
      limit: 50,
    });
    assert.deepEqual(publicResults.data.map((gym) => gym.id), [targetGym.id]);
    assert.deepEqual(publicResults.data[0]?.tags.map((tag) => tag.code), [shower.code, parking.code]);

    const activeCatalog = await listActiveGymTags();
    assert.ok(activeCatalog.some((tag) => tag.code === shower.code));
    assert.equal(activeCatalog.some((tag) => tag.code === hidden.code), false);

    const deactivated = await updateOperationsGymTag(parking.id, {
      code: parking.code,
      label: parking.label,
      description: parking.description,
      sortOrder: parking.sortOrder,
      isActive: false,
      expectedUpdatedAt: parking.updatedAt.toISOString(),
    });
    assert.equal(deactivated.isActive, false);
    assert.deepEqual((await listGyms({ q: suffix, facility: [], tag: [parking.code], limit: 50 })).data, []);

    await assert.rejects(
      () => replaceOperationsGymTags(targetGym.id, { tagIds: [], expectedUpdatedAt: targetGym.updatedAt.toISOString() }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPS_RESOURCE_CHANGED',
    );
    await assert.rejects(
      () => deleteOperationsGymTag(shower.id, { expectedUpdatedAt: shower.updatedAt.toISOString() }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPS_GYM_TAG_ASSIGNED',
    );
    assert.ok(targetAssignment.gym.updatedAt > targetGym.updatedAt);
  } finally {
    if (resourceIds.length > 0) await database.delete(auditEvents).where(inArray(auditEvents.resourceId, resourceIds));
    if (gymIds.length > 0) await database.delete(gyms).where(inArray(gyms.id, gymIds));
    if (tagIds.length > 0) await database.delete(gymTags).where(inArray(gymTags.id, tagIds));
    await closeDatabase();
  }
});
