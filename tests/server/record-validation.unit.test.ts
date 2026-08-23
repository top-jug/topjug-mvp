import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordSchema, listRecordsSchema } from '../../src/server/records/record-validation';

const validRecord = {
  gymId: '00000000-0000-4000-8000-000000000010',
  startedAt: '2026-08-23T10:00:00+09:00',
  endedAt: '2026-08-23T12:00:00+09:00',
  rating: 4.5,
  mode: 'normal' as const,
  counts: [{
    gymGradeId: '00000000-0000-4000-8000-000000000020',
    sectorCode: 'sector-1',
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

test('record list limits are coerced and bounded', () => {
  assert.equal(listRecordsSchema.parse({ limit: '50' }).limit, 50);
  assert.equal(listRecordsSchema.safeParse({ limit: '101' }).success, false);
});

test('request schemas reject unknown properties', () => {
  assert.equal(createRecordSchema.safeParse({ ...validRecord, unexpected: true }).success, false);
  assert.equal(listRecordsSchema.safeParse({ limit: '20', unexpected: true }).success, false);
});
