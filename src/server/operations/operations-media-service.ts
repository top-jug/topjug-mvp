import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, mediaAssets } from '../db/schema';
import { ApiError } from '../http/api-error';
import { processImage } from '../media/image-processing';
import { createMediaObjectStorage, type MediaObjectStorage, OPERATIONS_MEDIA_STORAGE_PREFIX } from '../media/media-storage';
import { publicMediaUrl } from '../media/media-url';
import { auditEventValues, writeAuditEvent } from '../observability/audit';
import { logger } from '../observability/logger';

interface MediaAssetRecord {
  id: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string | null;
  status: 'pending' | 'ready' | 'deleted';
  createdAt: Date;
  readyAt: Date | null;
}

export interface OperationsMediaRepository {
  createPending(input: MediaAssetRecord & { ownerUserId: string }): Promise<void>;
  markReady(id: string): Promise<MediaAssetRecord>;
  markFailed(id: string): Promise<void>;
  removeFailed(id: string): Promise<void>;
}

function createOperationsMediaRepository(): OperationsMediaRepository {
  return {
    async createPending(input) {
      await getDatabase().insert(mediaAssets).values(input);
    },
    async markReady(id) {
      return getDatabase().transaction(async (transaction) => {
        const [asset] = await transaction.update(mediaAssets).set({
          status: 'ready',
          readyAt: sql`clock_timestamp()`,
        }).where(and(eq(mediaAssets.id, id), eq(mediaAssets.status, 'pending'))).returning({
          id: mediaAssets.id,
          storageKey: mediaAssets.storageKey,
          contentType: mediaAssets.contentType,
          byteSize: mediaAssets.byteSize,
          checksumSha256: mediaAssets.checksumSha256,
          status: mediaAssets.status,
          createdAt: mediaAssets.createdAt,
          readyAt: mediaAssets.readyAt,
        });
        if (!asset) throw new Error('Pending media asset was not available');
        await transaction.insert(auditEvents).values(auditEventValues({
          action: 'ops.media.upload',
          resourceType: 'media_asset',
          resourceId: id,
          metadata: { contentType: asset.contentType, byteSize: asset.byteSize },
        }));
        return asset;
      });
    },
    async markFailed(id) {
      await getDatabase().update(mediaAssets).set({
        status: 'deleted',
        deletedAt: sql`clock_timestamp()`,
      }).where(and(eq(mediaAssets.id, id), eq(mediaAssets.status, 'pending')));
    },
    async removeFailed(id) {
      await getDatabase().delete(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.status, 'deleted')));
    },
  };
}

function storageKey(assetId: string, now: Date) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${OPERATIONS_MEDIA_STORAGE_PREFIX}${year}/${month}/${assetId}.webp`;
}

function responseAsset(asset: MediaAssetRecord) {
  return {
    ...asset,
    url: publicMediaUrl(asset.storageKey),
  };
}

export async function uploadOperationsImage(
  input: { ownerUserId: string; body: Buffer; declaredContentType: string },
  dependencies: {
    repository?: OperationsMediaRepository;
    storage?: MediaObjectStorage;
    now?: Date;
    assetId?: string;
    auditFailure?: (assetId: string) => Promise<unknown>;
  } = {},
) {
  const processed = await processImage(input.body, input.declaredContentType);
  const repository = dependencies.repository ?? createOperationsMediaRepository();
  const storage = dependencies.storage ?? createMediaObjectStorage();
  const now = dependencies.now ?? new Date();
  const assetId = dependencies.assetId ?? randomUUID();
  const key = storageKey(assetId, now);
  const pending: MediaAssetRecord & { ownerUserId: string } = {
    id: assetId,
    ownerUserId: input.ownerUserId,
    storageKey: key,
    contentType: processed.contentType,
    byteSize: processed.byteSize,
    checksumSha256: processed.checksumSha256,
    status: 'pending',
    createdAt: now,
    readyAt: null,
  };

  try {
    await repository.createPending(pending);
  } catch (error) {
    logger.error('ops.media.pending_create_failed', {
      mediaAssetId: assetId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw new ApiError(503, 'MEDIA_UPLOAD_FAILED', '이미지를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  try {
    await storage.put({
      key,
      body: processed.body,
      contentType: processed.contentType,
      checksumSha256: processed.checksumSha256,
    });
    return responseAsset(await repository.markReady(assetId));
  } catch (error) {
    await repository.markFailed(assetId).catch((cleanupError) => {
      logger.error('ops.media.mark_failed_error', {
        mediaAssetId: assetId,
        errorName: cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
      });
    });
    try {
      await storage.delete(key);
      await repository.removeFailed(assetId);
    } catch (cleanupError) {
      logger.error('ops.media.object_cleanup_failed', {
        mediaAssetId: assetId,
        errorName: cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
      });
    }
    await (dependencies.auditFailure ?? ((failedAssetId: string) => writeAuditEvent({
      action: 'ops.media.upload',
      outcome: 'failure',
      resourceType: 'media_asset',
      resourceId: failedAssetId,
    })))(assetId);
    logger.error('ops.media.upload_failed', {
      mediaAssetId: assetId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw new ApiError(503, 'MEDIA_UPLOAD_FAILED', '이미지를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
}
