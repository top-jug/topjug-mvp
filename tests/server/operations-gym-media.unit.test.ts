import assert from 'node:assert/strict';
import test from 'node:test';
import { operationsGymPhotoMutationSchema } from '../../src/server/operations/operations-gym-media-validation';
import { MAX_OPERATIONS_GYM_PHOTOS } from '../../src/server/operations/operations-gym-media-service';

test('gym photo mutations require one timezone-aware resource version', () => {
  assert.equal(operationsGymPhotoMutationSchema.safeParse({ expectedUpdatedAt: '2026-09-02T10:00:00Z' }).success, true);
  assert.equal(operationsGymPhotoMutationSchema.safeParse({ expectedUpdatedAt: '2026-09-02T10:00:00' }).success, false);
  assert.equal(operationsGymPhotoMutationSchema.safeParse({ expectedUpdatedAt: '2026-09-02T10:00:00Z', altText: '제외 범위' }).success, false);
  assert.equal(MAX_OPERATIONS_GYM_PHOTOS, 20);
});
