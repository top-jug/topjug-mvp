import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperationsSettingEventSchema,
  updateOperationsSettingEventSchema,
} from '../../src/server/operations/operations-setting-event-validation';

const sectorId = '38a4ba3e-0f89-4bc8-81f9-a95d91bca5f2';
const gymId = 'c3ad4337-eab7-47d4-b4df-2e6f50a8b197';

test('operations setting-event validation accepts normalized schedule fields', () => {
  const result = createOperationsSettingEventSchema.parse({
    gymId,
    title: '  A벽 세팅  ',
    startsAt: '2026-09-10T01:00:00Z',
    endsAt: '2026-09-10T04:00:00Z',
    note: '  ',
    sectorIds: [sectorId],
  });
  assert.equal(result.title, 'A벽 세팅');
  assert.equal(result.note, null);
});

test('operations setting-event validation rejects invalid ranges, duplicate sectors, and empty updates', () => {
  const base = {
    gymId,
    title: 'A벽 세팅',
    startsAt: '2026-09-10T04:00:00Z',
    endsAt: '2026-09-10T01:00:00Z',
    note: null,
    sectorIds: [sectorId],
  };
  assert.equal(createOperationsSettingEventSchema.safeParse(base).success, false);
  assert.equal(createOperationsSettingEventSchema.safeParse({
    ...base,
    endsAt: null,
    sectorIds: [sectorId, sectorId],
  }).success, false);
  assert.equal(updateOperationsSettingEventSchema.safeParse({
    expectedUpdatedAt: '2026-09-10T01:00:00Z',
  }).success, false);
});
