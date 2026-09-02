import 'server-only';

import { and, asc, count, eq, max, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, gymMedia, gyms, mediaAssets } from '../db/schema';
import { ApiError } from '../http/api-error';
import { OPERATIONS_MEDIA_STORAGE_PREFIX } from '../media/media-storage';
import { publicMediaUrl } from '../media/media-url';
import { auditEventValues } from '../observability/audit';
import type { OperationsGymPhotoMutationInput } from './operations-gym-media-validation';

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export const MAX_OPERATIONS_GYM_PHOTOS = 20;

const photoSelection = {
  gymMediaId: gymMedia.id,
  mediaAssetId: mediaAssets.id,
  storageKey: mediaAssets.storageKey,
  contentType: mediaAssets.contentType,
  byteSize: mediaAssets.byteSize,
  sortOrder: gymMedia.sortOrder,
  createdAt: gymMedia.createdAt,
};

async function loadGym(transaction: Database | Transaction, gymId: string) {
  const [gym] = await transaction.select({
    id: gyms.id,
    name: gyms.name,
    branchName: gyms.branchName,
    updatedAt: gyms.updatedAt,
  }).from(gyms).where(eq(gyms.id, gymId)).limit(1);
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
  return gym;
}

async function lockGym(transaction: Transaction, gymId: string, expectedUpdatedAt: string) {
  const [gym] = await transaction.select({ id: gyms.id, updatedAt: gyms.updatedAt })
    .from(gyms)
    .where(eq(gyms.id, gymId))
    .limit(1)
    .for('update');
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
  if (gym.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new ApiError(409, 'OPS_RESOURCE_CHANGED', '다른 운영자가 암장 정보를 변경했습니다. 최신 정보를 확인해주세요.');
  }
}

async function loadPhotos(transaction: Database | Transaction, gymId: string) {
  const rows = await transaction.select(photoSelection)
    .from(gymMedia)
    .innerJoin(mediaAssets, eq(gymMedia.mediaAssetId, mediaAssets.id))
    .where(and(
      eq(gymMedia.gymId, gymId),
      eq(gymMedia.type, 'photo'),
      eq(mediaAssets.status, 'ready'),
    ))
    .orderBy(asc(gymMedia.sortOrder), asc(gymMedia.id));
  return rows.map((row) => ({ ...row, url: publicMediaUrl(row.storageKey) }));
}

async function loadResponse(transaction: Database | Transaction, gymId: string) {
  const [gym, photos] = await Promise.all([
    loadGym(transaction, gymId),
    loadPhotos(transaction, gymId),
  ]);
  return { gym, photos, maxPhotos: MAX_OPERATIONS_GYM_PHOTOS };
}

export function getOperationsGymPhotos(gymId: string) {
  return loadResponse(getDatabase(), gymId);
}

export async function assertOperationsGymPhotoUploadAllowed(gymId: string, expectedUpdatedAt: string) {
  const database = getDatabase();
  const [gym, [{ photoCount }]] = await Promise.all([
    loadGym(database, gymId),
    database.select({ photoCount: count() })
      .from(gymMedia)
      .where(and(eq(gymMedia.gymId, gymId), eq(gymMedia.type, 'photo'))),
  ]);
  if (gym.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new ApiError(409, 'OPS_RESOURCE_CHANGED', '다른 운영자가 암장 정보를 변경했습니다. 최신 정보를 확인해주세요.');
  }
  if (photoCount >= MAX_OPERATIONS_GYM_PHOTOS) {
    throw new ApiError(409, 'OPS_GYM_PHOTO_LIMIT', `암장 사진은 최대 ${MAX_OPERATIONS_GYM_PHOTOS}장까지 등록할 수 있습니다.`);
  }
}

export async function attachOperationsGymPhoto(
  gymId: string,
  mediaAssetId: string,
  actorUserId: string,
  input: OperationsGymPhotoMutationInput,
) {
  return getDatabase().transaction(async (transaction) => {
    await lockGym(transaction, gymId, input.expectedUpdatedAt);

    const [asset] = await transaction.select({
      id: mediaAssets.id,
      ownerUserId: mediaAssets.ownerUserId,
      storageKey: mediaAssets.storageKey,
      status: mediaAssets.status,
    }).from(mediaAssets).where(eq(mediaAssets.id, mediaAssetId)).limit(1).for('update');
    if (
      !asset ||
      asset.ownerUserId !== actorUserId ||
      asset.status !== 'ready' ||
      !asset.storageKey.startsWith(OPERATIONS_MEDIA_STORAGE_PREFIX)
    ) {
      throw new ApiError(400, 'OPS_MEDIA_NOT_ATTACHABLE', '방금 업로드한 준비 완료 이미지만 암장에 추가할 수 있습니다.');
    }

    const [[{ photoCount, lastSortOrder }], [{ referenceCount }]] = await Promise.all([
      transaction.select({ photoCount: count(), lastSortOrder: max(gymMedia.sortOrder) })
        .from(gymMedia)
        .where(and(eq(gymMedia.gymId, gymId), eq(gymMedia.type, 'photo'))),
      transaction.select({ referenceCount: count() })
        .from(gymMedia)
        .where(eq(gymMedia.mediaAssetId, mediaAssetId)),
    ]);
    if (photoCount >= MAX_OPERATIONS_GYM_PHOTOS) {
      throw new ApiError(409, 'OPS_GYM_PHOTO_LIMIT', `암장 사진은 최대 ${MAX_OPERATIONS_GYM_PHOTOS}장까지 등록할 수 있습니다.`);
    }
    if (referenceCount > 0) {
      throw new ApiError(409, 'OPS_MEDIA_ALREADY_ATTACHED', '이미 암장에 연결된 이미지입니다.');
    }

    const [created] = await transaction.insert(gymMedia).values({
      gymId,
      mediaAssetId,
      type: 'photo',
      altText: null,
      sortOrder: (lastSortOrder ?? -1) + 1,
    }).returning({ id: gymMedia.id });
    await transaction.update(gyms).set({
      updatedAt: sql`greatest(clock_timestamp(), ${gyms.updatedAt} + interval '1 millisecond')`,
    }).where(eq(gyms.id, gymId));
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.photo.add',
      resourceType: 'gym',
      resourceId: gymId,
      metadata: { gymMediaId: created.id, mediaAssetId, photoCount: photoCount + 1 },
    }));
    return loadResponse(transaction, gymId);
  });
}

export async function deleteOperationsGymPhoto(
  gymId: string,
  gymMediaId: string,
  input: OperationsGymPhotoMutationInput,
) {
  return getDatabase().transaction(async (transaction) => {
    await lockGym(transaction, gymId, input.expectedUpdatedAt);
    const [photo] = await transaction.select({ mediaAssetId: gymMedia.mediaAssetId })
      .from(gymMedia)
      .where(and(eq(gymMedia.id, gymMediaId), eq(gymMedia.gymId, gymId), eq(gymMedia.type, 'photo')))
      .limit(1)
      .for('update');
    if (!photo) throw new ApiError(404, 'OPS_GYM_PHOTO_NOT_FOUND', '삭제할 암장 사진을 찾을 수 없습니다.');

    await transaction.delete(gymMedia).where(eq(gymMedia.id, gymMediaId));
    await transaction.update(gyms).set({
      updatedAt: sql`greatest(clock_timestamp(), ${gyms.updatedAt} + interval '1 millisecond')`,
    }).where(eq(gyms.id, gymId));
    const [{ photoCount }] = await transaction.select({ photoCount: count() })
      .from(gymMedia)
      .where(and(eq(gymMedia.gymId, gymId), eq(gymMedia.type, 'photo')));
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.photo.delete',
      resourceType: 'gym',
      resourceId: gymId,
      metadata: { gymMediaId, mediaAssetId: photo.mediaAssetId, photoCount },
    }));
    return loadResponse(transaction, gymId);
  });
}
