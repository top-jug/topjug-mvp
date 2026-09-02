import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, gymMedia, gyms, mediaAssets, users } from '../../src/server/db/schema';
import { getGym, listGyms } from '../../src/server/gyms/gym-service';
import { ApiError } from '../../src/server/http/api-error';
import {
  attachOperationsGymPhoto,
  deleteOperationsGymPhoto,
  getOperationsGymPhotos,
} from '../../src/server/operations/operations-gym-media-service';

test('operations gym photos enforce versions and update public card and detail media', async (context) => {
  const database = getDatabase();
  const [operator] = await database.select({ id: users.id }).from(users)
    .where(eq(users.email, 'ops-review@example.com')).limit(1);
  if (!operator) {
    context.skip('기존 ops-review@example.com 계정이 로컬 DB에 없어 통합 검증을 건너뜁니다.');
    await closeDatabase();
    return;
  }

  const suffix = randomUUID().slice(0, 8);
  const assetIds = [randomUUID(), randomUUID(), randomUUID()];
  let gymId = '';
  try {
    const [gym] = await database.insert(gyms).values({
      name: `사진 테스트 암장 ${suffix}`,
      address: '서울특별시 테스트로 1',
    }).returning({ id: gyms.id, updatedAt: gyms.updatedAt });
    gymId = gym.id;
    await database.insert(mediaAssets).values(assetIds.map((id, index) => ({
      id,
      ownerUserId: index === 0 ? null : operator.id,
      storageKey: index === 0 ? `imports/${id}.webp` : `gyms/uploads/2026/09/${id}.webp`,
      contentType: 'image/webp',
      byteSize: 1024 + index,
      status: 'ready' as const,
      readyAt: new Date(),
    })));
    await database.insert(gymMedia).values({
      gymId,
      mediaAssetId: assetIds[0],
      type: 'cover',
      sortOrder: 0,
    });

    await assert.rejects(
      () => attachOperationsGymPhoto(gymId, assetIds[0], operator.id, {
        expectedUpdatedAt: gym.updatedAt.toISOString(),
      }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPS_MEDIA_NOT_ATTACHABLE',
    );

    const first = await attachOperationsGymPhoto(gymId, assetIds[1], operator.id, {
      expectedUpdatedAt: gym.updatedAt.toISOString(),
    });
    const second = await attachOperationsGymPhoto(gymId, assetIds[2], operator.id, {
      expectedUpdatedAt: first.gym.updatedAt.toISOString(),
    });
    assert.deepEqual(second.photos.map((photo) => photo.mediaAssetId), assetIds.slice(1));
    assert.equal((await getOperationsGymPhotos(gymId)).photos.length, 2);

    const publicList = await listGyms({ q: suffix, facility: [], tag: [], limit: 10 });
    assert.equal(publicList.data[0]?.cover?.id, assetIds[2]);
    const publicDetail = await getGym(gymId);
    assert.deepEqual(
      publicDetail.media.filter((media) => media.type === 'photo').map((media) => media.id),
      assetIds.slice(1),
    );

    await assert.rejects(
      () => deleteOperationsGymPhoto(gymId, second.photos[1].gymMediaId, { expectedUpdatedAt: first.gym.updatedAt.toISOString() }),
      (error: unknown) => error instanceof ApiError && error.code === 'OPS_RESOURCE_CHANGED',
    );
    const deleted = await deleteOperationsGymPhoto(gymId, second.photos[1].gymMediaId, {
      expectedUpdatedAt: second.gym.updatedAt.toISOString(),
    });
    assert.deepEqual(deleted.photos.map((photo) => photo.mediaAssetId), [assetIds[1]]);
    assert.equal((await listGyms({ q: suffix, facility: [], tag: [], limit: 10 })).data[0]?.cover?.id, assetIds[1]);

    const audits = await database.select({ action: auditEvents.action }).from(auditEvents)
      .where(eq(auditEvents.resourceId, gymId));
    assert.deepEqual(audits.map((audit) => audit.action).sort(), [
      'ops.gym.photo.add',
      'ops.gym.photo.add',
      'ops.gym.photo.delete',
    ]);
  } finally {
    if (gymId) {
      await database.delete(auditEvents).where(eq(auditEvents.resourceId, gymId));
      await database.delete(gyms).where(eq(gyms.id, gymId));
    }
    await database.delete(mediaAssets).where(inArray(mediaAssets.id, assetIds));
    await closeDatabase();
  }
});
