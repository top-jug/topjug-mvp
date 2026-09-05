import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';
import { ApiError } from '../../src/server/http/api-error';
import { IMAGE_OUTPUT_CONTENT_TYPE, MAX_IMAGE_INPUT_BYTES, processImage } from '../../src/server/media/image-processing';
import { MAX_MEDIA_MULTIPART_BODY_BYTES, readImageUpload, readOperationsGymPhotoUpload } from '../../src/server/media/media-upload-request';
import type { MediaObjectStorage } from '../../src/server/media/media-storage';
import { uploadOperationsImage, type OperationsMediaRepository } from '../../src/server/operations/operations-media-service';

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

async function samplePng() {
  return sharp({
    create: { width: 20, height: 10, channels: 4, background: { r: 20, g: 120, b: 220, alpha: 0.75 } },
  }).png().toBuffer();
}

test('image processing decodes content, auto-orients, bounds dimensions, and strips metadata', async () => {
  const input = await sharp({
    create: { width: 3000, height: 1000, channels: 3, background: { r: 30, g: 80, b: 160 } },
  }).jpeg().withMetadata({ orientation: 6 }).toBuffer();

  const processed = await processImage(input, 'image/jpeg');
  const metadata = await sharp(processed.body).metadata();

  assert.equal(processed.contentType, IMAGE_OUTPUT_CONTENT_TYPE);
  assert.equal(metadata.format, 'webp');
  assert.deepEqual([metadata.width, metadata.height], [853, 2560]);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(processed.checksumSha256, createHash('sha256').update(processed.body).digest('hex'));
});

test('image processing rejects MIME mismatches, damaged files, and oversized inputs', async () => {
  const png = await samplePng();
  await assert.rejects(
    () => processImage(png, 'image/jpeg'),
    (error: unknown) => error instanceof ApiError && error.code === 'INVALID_IMAGE',
  );
  await assert.rejects(
    () => processImage(Buffer.from('not-an-image'), 'image/png'),
    (error: unknown) => error instanceof ApiError && error.code === 'INVALID_IMAGE',
  );
  await assert.rejects(
    () => processImage(Buffer.alloc(MAX_IMAGE_INPUT_BYTES + 1), 'image/png'),
    (error: unknown) => error instanceof ApiError && error.status === 413 && error.code === 'IMAGE_TOO_LARGE',
  );
});

test('multipart parsing accepts exactly one file and rejects extra fields and oversized bodies', async () => {
  const png = await samplePng();
  const form = new FormData();
  form.set('file', new File([png], 'ignored-name.png', { type: 'image/png' }));
  const parsed = await readImageUpload(new Request('http://localhost/api/v1/ops/media/images', { method: 'POST', body: form }));
  assert.deepEqual(parsed.body, png);
  assert.equal(parsed.declaredContentType, 'image/png');

  form.set('caption', 'must not be accepted');
  await assert.rejects(
    () => readImageUpload(new Request('http://localhost/api/v1/ops/media/images', { method: 'POST', body: form })),
    (error: unknown) => error instanceof ApiError && error.code === 'INVALID_MULTIPART_BODY',
  );
  await assert.rejects(
    () => readImageUpload(new Request('http://localhost/api/v1/ops/media/images', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=test', 'content-length': String(MAX_IMAGE_INPUT_BYTES + 65_537) },
      body: '--test--',
    })),
    (error: unknown) => error instanceof ApiError && error.status === 413,
  );
  const oversizedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_MEDIA_MULTIPART_BODY_BYTES + 1));
      controller.close();
    },
  });
  await assert.rejects(
    () => readImageUpload(new Request('http://localhost/api/v1/ops/media/images', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
      body: oversizedStream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })),
    (error: unknown) => error instanceof ApiError && error.status === 413,
  );
});

test('gym photo multipart parsing accepts one file and one optimistic-concurrency version', async () => {
  const png = await samplePng();
  const form = new FormData();
  form.set('file', new File([png], 'gym.png', { type: 'image/png' }));
  form.set('expectedUpdatedAt', '2026-09-02T10:00:00.000Z');
  const parsed = await readOperationsGymPhotoUpload(new Request('http://localhost/api/v1/ops/gyms/gym/media', {
    method: 'POST', body: form,
  }));
  assert.deepEqual(parsed.body, png);
  assert.equal(parsed.expectedUpdatedAt, '2026-09-02T10:00:00.000Z');

  form.set('altText', 'MVP에서 지원하지 않음');
  await assert.rejects(
    () => readOperationsGymPhotoUpload(new Request('http://localhost/api/v1/ops/gyms/gym/media', { method: 'POST', body: form })),
    (error: unknown) => error instanceof ApiError && error.code === 'INVALID_MULTIPART_BODY',
  );
});

function fakeRepository(events: string[]): OperationsMediaRepository {
  let pending: Parameters<OperationsMediaRepository['createPending']>[0] | undefined;
  return {
    async createPending(input) {
      pending = input;
      events.push(`pending:${input.storageKey}`);
    },
    async markReady(id) {
      assert.equal(id, pending?.id);
      events.push('ready');
      return { ...pending!, status: 'ready', readyAt: new Date('2026-09-01T03:00:01Z') };
    },
    async markFailed(id) {
      assert.equal(id, pending?.id);
      events.push('failed');
    },
    async removeFailed(id) {
      assert.equal(id, pending?.id);
      events.push('removed');
    },
  };
}

test('operations upload uses an immutable key and transitions pending media to ready', async () => {
  const events: string[] = [];
  const storage: MediaObjectStorage = {
    async put(input) {
      events.push(`put:${input.key}:${input.contentType}`);
      assert.equal(input.checksumSha256, createHash('sha256').update(input.body).digest('hex'));
    },
    async delete() { throw new Error('delete should not be called'); },
  };
  const result = await uploadOperationsImage({
    ownerUserId: '00000000-0000-4000-8000-000000000001',
    body: await samplePng(),
    declaredContentType: 'image/png',
  }, {
    repository: fakeRepository(events),
    storage,
    now: new Date('2026-09-01T03:00:00Z'),
    assetId: '00000000-0000-4000-8000-000000000002',
  });

  assert.equal(result.storageKey, 'gyms/uploads/2026/09/00000000-0000-4000-8000-000000000002.webp');
  assert.equal(result.status, 'ready');
  assert.deepEqual(events.map((event) => event.split(':')[0]), ['pending', 'put', 'ready']);
});

test('operations upload marks and removes failed assets after object cleanup', async () => {
  const events: string[] = [];
  const png = await samplePng();
  const storage: MediaObjectStorage = {
    async put() {
      events.push('put');
      throw new Error('simulated S3 failure');
    },
    async delete(key) { events.push(`delete:${key}`); },
  };

  await assert.rejects(
    () => uploadOperationsImage({
      ownerUserId: '00000000-0000-4000-8000-000000000001',
      body: png,
      declaredContentType: 'image/png',
    }, {
      repository: fakeRepository(events),
      storage,
      now: new Date('2026-09-01T03:00:00Z'),
      assetId: '00000000-0000-4000-8000-000000000003',
      auditFailure: async () => { events.push('audit-failure'); },
    }),
    (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === 'MEDIA_UPLOAD_FAILED',
  );
  assert.deepEqual(events.map((event) => event.split(':')[0]), ['pending', 'put', 'failed', 'delete', 'removed', 'audit-failure']);
});

test('media infrastructure keeps production IAM and body limits narrowly scoped', () => {
  const template = source('ops/aws/production-data.yaml');
  const caddy = source('ops/ec2/Caddyfile');
  const service = source('ops/ec2/topjug-web.service');
  const route = source('apps/web/app/api/v1/ops/media/images/route.ts');
  const packageJson = JSON.parse(source('package.json')) as { dependencies: Record<string, string> };

  assert.equal(packageJson.dependencies.sharp, '0.35.4');
  assert.match(template, /ApplicationMediaUploadPolicy:[\s\S]*s3:PutObject[\s\S]*s3:DeleteObject[\s\S]*\$\{MediaBucket\.Arn\}\/gyms\/uploads\/\*/);
  assert.doesNotMatch(template.match(/ApplicationMediaUploadPolicy:[\s\S]*?(?=\n  GithubMigrationPolicy:)/)?.[0] ?? '', /s3:(GetObject|ListBucket)|Action:\s+s3:\*/);
  assert.match(caddy, /@mediaUpload[\s\S]*max_size 11MB[\s\S]*@standardBody[\s\S]*max_size 64KB/);
  assert.match(caddy, /path \/api\/v1\/ops\/media\/images \/api\/v1\/ops\/gyms\/\*\/media/);
  assert.match(caddy, /@standardBody not path \/api\/v1\/ops\/media\/images \/api\/v1\/ops\/gyms\/\*\/media/);
  assert.match(service, /MEDIA_S3_BUCKET=topjug-mvp-media-345736953998-ap-northeast-2/);
  assert.match(route, /requireOperationsAdmin\(request\)[\s\S]*readImageUpload\(request\)/);
});
