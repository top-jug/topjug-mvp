import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import postgres from 'postgres';
import { databaseUrl } from './database-url.mjs';

const PREFIX = 'gyms/uploads/';
const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 100;

function storageSettings() {
  const bucket = process.env.MEDIA_S3_BUCKET?.trim();
  if (!bucket) throw new Error('MEDIA_S3_BUCKET is required');
  const endpoint = process.env.MEDIA_S3_ENDPOINT?.trim() || undefined;
  const forcePathStyle = process.env.MEDIA_S3_FORCE_PATH_STYLE === 'true';
  if (process.env.APP_PROFILE === 'production' && (endpoint || forcePathStyle || process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY)) {
    throw new Error('Production media cleanup must use the EC2 instance role');
  }
  return { bucket, endpoint, forcePathStyle };
}

async function candidates(client) {
  return client`
    select id, storage_key
    from media_assets asset
    where asset.storage_key like ${`${PREFIX}%`}
      and not exists (select 1 from gym_media where media_asset_id = asset.id)
      and not exists (select 1 from gym_walls where map_media_asset_id = asset.id)
      and not exists (select 1 from gym_sectors where map_media_asset_id = asset.id)
      and not exists (select 1 from record_shares where media_asset_id = asset.id)
      and (
        (asset.status = 'pending' and asset.created_at < now() - interval '1 hour')
        or (asset.status = 'ready' and asset.created_at < now() - interval '24 hours')
        or asset.status = 'deleted'
      )
    order by asset.created_at
    limit ${BATCH_SIZE}
  `;
}

async function claim(client, assetId) {
  return client`
    update media_assets asset
    set status = 'deleted', deleted_at = clock_timestamp()
    where asset.id = ${assetId}
      and asset.storage_key like ${`${PREFIX}%`}
      and not exists (select 1 from gym_media where media_asset_id = asset.id)
      and not exists (select 1 from gym_walls where map_media_asset_id = asset.id)
      and not exists (select 1 from gym_sectors where map_media_asset_id = asset.id)
      and not exists (select 1 from record_shares where media_asset_id = asset.id)
      and (
        (asset.status = 'pending' and asset.created_at < now() - interval '1 hour')
        or (asset.status = 'ready' and asset.created_at < now() - interval '24 hours')
        or asset.status = 'deleted'
      )
    returning asset.id, asset.storage_key
  `;
}

async function main() {
  const settings = storageSettings();
  const client = postgres(await databaseUrl(), { max: 1 });
  const storage = new S3Client({
    region: process.env.AWS_REGION ?? 'ap-northeast-2',
    endpoint: settings.endpoint,
    forcePathStyle: settings.forcePathStyle,
  });
  let deleted = 0;
  let failed = 0;

  try {
    const found = await candidates(client);
    if (APPLY) {
      for (const candidate of found) {
        const [asset] = await claim(client, candidate.id);
        if (!asset) continue;
        try {
          await storage.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: asset.storage_key }));
          await client`delete from media_assets where id = ${asset.id} and status = 'deleted'`;
          deleted += 1;
        } catch (error) {
          failed += 1;
          console.error(JSON.stringify({
            event: 'media.cleanup_object_failed',
            mediaAssetId: asset.id,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          }));
        }
      }
    }
    console.info(JSON.stringify({
      event: 'media.cleanup_completed',
      apply: APPLY,
      candidates: found.length,
      deleted,
      failed,
    }));
    if (failed > 0) process.exitCode = 1;
  } finally {
    storage.destroy();
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
