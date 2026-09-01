import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperationsGymTagSchema,
  replaceOperationsGymTagsSchema,
  updateOperationsGymTagSchema,
} from '../../src/server/operations/operations-gym-tag-validation';

const validTag = {
  code: 'kilter_board',
  label: '킬터보드',
  description: null,
  sortOrder: 20,
  isActive: true,
};

test('operations keyword validation normalizes safe codes and rejects unsafe values', () => {
  assert.equal(createOperationsGymTagSchema.parse({ ...validTag, code: ' KILTER_BOARD ' }).code, 'kilter_board');
  assert.equal(createOperationsGymTagSchema.safeParse({ ...validTag, code: '한글 코드' }).success, false);
  assert.equal(createOperationsGymTagSchema.safeParse({ ...validTag, sortOrder: -1 }).success, false);
});

test('operations keyword mutation requires versions and unique assignment IDs', () => {
  assert.equal(updateOperationsGymTagSchema.safeParse(validTag).success, false);
  assert.equal(updateOperationsGymTagSchema.safeParse({ ...validTag, expectedUpdatedAt: '2026-08-31T08:00:00Z' }).success, true);
  const tagId = '38a4ba3e-0f89-4bc8-81f9-a95d91bca5f2';
  assert.equal(replaceOperationsGymTagsSchema.safeParse({ tagIds: [tagId], expectedUpdatedAt: '2026-08-31T08:00:00Z' }).success, true);
  assert.equal(replaceOperationsGymTagsSchema.safeParse({ tagIds: [tagId, tagId], expectedUpdatedAt: '2026-08-31T08:00:00Z' }).success, false);
});
