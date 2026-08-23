import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordSchema, listRecordsSchema, readJson, startRecordSessionSchema } from '../../src/server/records/record-validation';
import { ApiError } from '../../src/server/http/api-error';

const validRecord = {
  gymId: '00000000-0000-4000-8000-000000000010',
  accessType: 'day_pass' as const,
  startedAt: '2026-08-23T10:00:00+09:00',
  endedAt: '2026-08-23T12:00:00+09:00',
  rating: 4.5,
  mode: 'normal' as const,
  counts: [{
    gymGradeId: '00000000-0000-4000-8000-000000000020',
    gymSectorId: '00000000-0000-4000-8000-000000000030',
    attempts: 5,
    sends: 3,
  }],
};

test('record creation accepts normalized domain values', () => {
  assert.equal(createRecordSchema.safeParse(validRecord).success, true);
});

test('record creation rejects impossible and duplicate counts', () => {
  const impossible = {
    ...validRecord,
    counts: [{ ...validRecord.counts[0], attempts: 2, sends: 3 }],
  };
  const duplicate = {
    ...validRecord,
    counts: [validRecord.counts[0], { ...validRecord.counts[0] }],
  };

  assert.equal(createRecordSchema.safeParse(impossible).success, false);
  assert.equal(createRecordSchema.safeParse(duplicate).success, false);
});

test('record creation rejects an end before its start', () => {
  const result = createRecordSchema.safeParse({
    ...validRecord,
    endedAt: '2026-08-23T09:00:00+09:00',
  });

  assert.equal(result.success, false);
});

test('record creation enforces access type and active duration semantics', () => {
  assert.equal(createRecordSchema.safeParse({ ...validRecord, accessType: 'membership' }).success, false);
  assert.equal(createRecordSchema.safeParse({
    ...validRecord,
    membershipId: '00000000-0000-4000-8000-000000000040',
  }).success, false);
  assert.equal(createRecordSchema.safeParse({ ...validRecord, activeDurationSeconds: 7_201 }).success, false);
});

test('live sessions require membership identity only for membership access', () => {
  const session = {
    gymId: validRecord.gymId,
    accessType: 'membership',
    startedAt: validRecord.startedAt,
    mode: 'normal',
  };
  assert.equal(startRecordSessionSchema.safeParse(session).success, false);
  assert.equal(startRecordSessionSchema.safeParse({
    ...session,
    membershipId: '00000000-0000-4000-8000-000000000040',
  }).success, true);
});

test('record list limits are coerced and bounded', () => {
  assert.equal(listRecordsSchema.parse({ limit: '50' }).limit, 50);
  assert.equal(listRecordsSchema.safeParse({ limit: '101' }).success, false);
});

test('request schemas reject unknown properties', () => {
  assert.equal(createRecordSchema.safeParse({ ...validRecord, unexpected: true }).success, false);
  assert.equal(listRecordsSchema.safeParse({ limit: '20', unexpected: true }).success, false);
});

test('JSON requests reject declared and streamed bodies over 64KB', async () => {
  await assert.rejects(
    () => readJson(new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-length': '65537' },
      body: '{}',
    })),
    (error: unknown) => error instanceof ApiError && error.status === 413,
  );

  const oversizedBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(65_537));
      controller.close();
    },
  });
  await assert.rejects(
    () => readJson(new Request('http://localhost', {
      method: 'POST',
      body: oversizedBody,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })),
    (error: unknown) => error instanceof ApiError && error.status === 413,
  );
});
