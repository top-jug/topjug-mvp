import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, climbingRecords, gyms, mediaAssets, memberships, recordCounts, recordShares } from '../db/schema';
import { ApiError } from '../http/api-error';
import { publicMediaUrl } from '../media/media-url';
import { auditEventValues } from '../observability/audit';
import { CreateShareInput } from './share-validation';

function hashShareToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createRecordShare(userId: string, recordId: string, input: CreateShareInput) {
  const token = randomBytes(32).toString('base64url');
  const share = await getDatabase().transaction(async (transaction) => {
    const [record] = await transaction.select({ id: climbingRecords.id }).from(climbingRecords)
      .where(and(eq(climbingRecords.id, recordId), eq(climbingRecords.userId, userId), eq(climbingRecords.status, 'completed')))
      .limit(1);
    if (!record) throw new ApiError(404, 'RECORD_NOT_FOUND', '기록을 찾을 수 없습니다.');
    if (input.mediaAssetId) {
      const [asset] = await transaction.select({ id: mediaAssets.id, contentType: mediaAssets.contentType }).from(mediaAssets)
        .where(and(eq(mediaAssets.id, input.mediaAssetId), eq(mediaAssets.ownerUserId, userId), eq(mediaAssets.status, 'ready')))
        .limit(1);
      if (!asset) throw new ApiError(400, 'INVALID_SHARE_MEDIA', '공유에 사용할 수 있는 이미지가 아닙니다.');
      if (!asset.contentType.startsWith('image/')) throw new ApiError(400, 'INVALID_SHARE_MEDIA_TYPE', '공유에는 이미지만 사용할 수 있습니다.');
    }
    const [created] = await transaction.insert(recordShares).values({
      recordId,
      tokenHash: hashShareToken(token),
      mediaAssetId: input.mediaAssetId ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    }).returning();
    await transaction.insert(auditEvents).values(auditEventValues({ action: 'record.share.create', resourceType: 'record_share', resourceId: created.id }));
    return created;
  });
  const publicBaseUrl = process.env.SHARE_PUBLIC_BASE_URL?.replace(/\/$/, '');
  return {
    id: share.id,
    status: share.status,
    mediaAssetId: share.mediaAssetId,
    expiresAt: share.expiresAt,
    revokedAt: share.revokedAt,
    createdAt: share.createdAt,
    token,
    apiPath: `/api/v1/shares/${token}`,
    publicUrl: publicBaseUrl ? `${publicBaseUrl}/${token}` : null,
  };
}

export async function listRecordShares(userId: string, recordId: string) {
  const database = getDatabase();
  const [record] = await database.select({ id: climbingRecords.id }).from(climbingRecords)
    .where(and(eq(climbingRecords.id, recordId), eq(climbingRecords.userId, userId))).limit(1);
  if (!record) throw new ApiError(404, 'RECORD_NOT_FOUND', '기록을 찾을 수 없습니다.');
  const rows = await database.select({
    id: recordShares.id,
    status: recordShares.status,
    mediaAssetId: recordShares.mediaAssetId,
    expiresAt: recordShares.expiresAt,
    revokedAt: recordShares.revokedAt,
    createdAt: recordShares.createdAt,
  }).from(recordShares).where(eq(recordShares.recordId, recordId)).orderBy(desc(recordShares.createdAt));
  const now = new Date();
  return { data: rows.map((share) => ({
    ...share,
    status: share.status === 'active' && share.expiresAt && share.expiresAt <= now ? 'expired' as const : share.status,
  })) };
}

export async function getRecordShare(token: string) {
  const database = getDatabase();
  const [share] = await database.select({
    id: recordShares.id,
    status: recordShares.status,
    expiresAt: recordShares.expiresAt,
    createdAt: recordShares.createdAt,
    media: {
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      contentType: mediaAssets.contentType,
      status: mediaAssets.status,
      deletedAt: mediaAssets.deletedAt,
    },
    record: {
      id: climbingRecords.id,
      startedAt: climbingRecords.startedAt,
      endedAt: climbingRecords.endedAt,
      rating: climbingRecords.rating,
      mode: climbingRecords.mode,
      accessType: climbingRecords.accessType,
      activeDurationSeconds: climbingRecords.activeDurationSeconds,
    },
    gym: { id: gyms.id, name: gyms.name, branchName: gyms.branchName },
    membership: { id: memberships.id, name: memberships.name },
  }).from(recordShares)
    .innerJoin(climbingRecords, eq(recordShares.recordId, climbingRecords.id))
    .innerJoin(gyms, eq(climbingRecords.gymId, gyms.id))
    .leftJoin(memberships, eq(climbingRecords.membershipId, memberships.id))
    .leftJoin(mediaAssets, eq(recordShares.mediaAssetId, mediaAssets.id))
    .where(eq(recordShares.tokenHash, hashShareToken(token))).limit(1);
  if (!share || share.status !== 'active') throw new ApiError(404, 'SHARE_NOT_FOUND', '공유 기록을 찾을 수 없습니다.');
  if (share.expiresAt && share.expiresAt <= new Date()) throw new ApiError(410, 'SHARE_EXPIRED', '공유 링크가 만료되었습니다.');
  if (share.media?.id && (share.media.status !== 'ready' || share.media.deletedAt)) {
    throw new ApiError(404, 'SHARE_MEDIA_NOT_FOUND', '공유 이미지를 찾을 수 없습니다.');
  }
  const [totals] = await database.select({
    sends: sql<number>`coalesce(sum(${recordCounts.sends}), 0)`.mapWith(Number),
    attempts: sql<number>`coalesce(sum(${recordCounts.attempts}), 0)`.mapWith(Number),
  }).from(recordCounts).where(eq(recordCounts.recordId, share.record.id));
  return {
    ...share,
    record: { ...share.record, sends: totals.sends, attempts: totals.attempts },
    media: share.media?.id ? { ...share.media, url: publicMediaUrl(share.media.storageKey!) } : null,
  };
}

export async function revokeRecordShare(userId: string, recordId: string, shareId: string) {
  const [share] = await getDatabase().update(recordShares).set({ status: 'revoked', revokedAt: new Date() })
    .from(climbingRecords)
    .where(and(
      eq(recordShares.id, shareId),
      eq(recordShares.recordId, recordId),
      eq(recordShares.recordId, climbingRecords.id),
      eq(climbingRecords.userId, userId),
      eq(recordShares.status, 'active'),
    )).returning({ id: recordShares.id });
  if (!share) throw new ApiError(404, 'SHARE_NOT_FOUND', '공유 기록을 찾을 수 없습니다.');
}
