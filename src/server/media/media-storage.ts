import 'server-only';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ApiError } from '../http/api-error';

export const OPERATIONS_MEDIA_STORAGE_PREFIX = 'gyms/uploads/';
export const IMMUTABLE_MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface MediaObjectStorage {
  put(input: { key: string; body: Buffer; contentType: string; checksumSha256: string }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface MediaStorageSettings {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
}

let cachedStorage: MediaObjectStorage | undefined;

export function readMediaStorageSettings(): MediaStorageSettings {
  const bucket = process.env.MEDIA_S3_BUCKET?.trim();
  if (!bucket) throw new ApiError(503, 'MEDIA_STORAGE_NOT_CONFIGURED', '미디어 저장소가 설정되지 않았습니다.');
  const endpoint = process.env.MEDIA_S3_ENDPOINT?.trim() || undefined;
  const forcePathStyle = process.env.MEDIA_S3_FORCE_PATH_STYLE === 'true';

  if (process.env.APP_PROFILE === 'production') {
    if (endpoint || forcePathStyle || process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY) {
      throw new ApiError(503, 'MEDIA_STORAGE_NOT_CONFIGURED', '운영 미디어 저장소 보안 설정이 올바르지 않습니다.');
    }
  }

  return {
    bucket,
    region: process.env.AWS_REGION ?? 'ap-northeast-2',
    endpoint,
    forcePathStyle,
  };
}

export function createMediaObjectStorage(): MediaObjectStorage {
  if (cachedStorage) return cachedStorage;
  const settings = readMediaStorageSettings();
  const client = new S3Client({
    region: settings.region,
    endpoint: settings.endpoint,
    forcePathStyle: settings.forcePathStyle,
  });

  cachedStorage = {
    async put(input) {
      await client.send(new PutObjectCommand({
        Bucket: settings.bucket,
        Key: input.key,
        Body: input.body,
        ContentLength: input.body.byteLength,
        ContentType: input.contentType,
        CacheControl: IMMUTABLE_MEDIA_CACHE_CONTROL,
        IfNoneMatch: '*',
        Metadata: { sha256: input.checksumSha256 },
      }));
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: key }));
    },
  };
  return cachedStorage;
}
