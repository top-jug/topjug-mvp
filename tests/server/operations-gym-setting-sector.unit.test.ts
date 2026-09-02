import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperationsGymSettingSectorSchema,
  deleteOperationsGymSettingSectorSchema,
  updateOperationsGymSettingSectorSchema,
} from '../../src/server/operations/operations-gym-setting-sector-validation';

const expectedUpdatedAt = '2026-09-03T08:00:00Z';

test('operations setting-sector validation trims names and requires gym versions', () => {
  assert.deepEqual(createOperationsGymSettingSectorSchema.parse({ name: '  NEW WAVE  ', expectedUpdatedAt }), {
    name: 'NEW WAVE',
    expectedUpdatedAt,
  });
  assert.equal(createOperationsGymSettingSectorSchema.safeParse({ name: '', expectedUpdatedAt }).success, false);
  assert.equal(updateOperationsGymSettingSectorSchema.safeParse({ name: 'ARCH', isActive: true }).success, false);
  assert.equal(updateOperationsGymSettingSectorSchema.safeParse({ name: 'ARCH', isActive: true, expectedUpdatedAt }).success, true);
  assert.equal(deleteOperationsGymSettingSectorSchema.safeParse({ expectedUpdatedAt }).success, true);
});
