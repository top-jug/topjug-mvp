import assert from 'node:assert/strict';
import test from 'node:test';
import { apiMembershipToItem, buildMembershipInput, parseMembershipCounts } from '../../src/features/membership/membership-contract';

const apiMembership = {
  id: 'membership-1',
  name: '10회권',
  type: 'count' as const,
  gymIds: ['gym-1'],
  gyms: [{ id: 'gym-1', name: '암장', branchName: null }],
  totalUses: 10,
  remainingUses: 0,
  validFrom: '2026-08-01T09:15:00.000Z',
  validUntil: '2026-09-01T18:45:00.000Z',
  note: null,
  homeFavorite: false,
  homeOrder: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
  eligibilityStatus: 'active' as const,
};

const gymOptions = [{ gymId: 'gym-1', gymName: '암장', lightBg: '#fff', darkText: '#000' }];

test('membership mapping preserves raw validity instants and updatedAt', () => {
  const item = apiMembershipToItem(apiMembership, gymOptions);
  assert.equal(item.validFrom, apiMembership.validFrom);
  assert.equal(item.validUntil, apiMembership.validUntil);
  assert.equal(item.updatedAt, apiMembership.updatedAt);

  const input = buildMembershipInput(item, gymOptions, [item]);
  assert.equal(input.validFrom, apiMembership.validFrom);
  assert.equal(input.validUntil, apiMembership.validUntil);
  assert.equal(input.remainingUses, 0);
  assert.equal(input.totalUses, 10);
});

test('only changed membership dates are converted from date-only input', () => {
  const item = apiMembershipToItem(apiMembership, gymOptions);
  const input = buildMembershipInput({ ...item, endDate: '2099.01.01' }, gymOptions, [item]);
  assert.equal(input.validFrom, apiMembership.validFrom);
  assert.notEqual(input.validUntil, apiMembership.validUntil);
});

test('membership counts accept zero and reject invalid or inverted values', () => {
  assert.deepEqual(parseMembershipCounts('0 / 0회'), { remainingUses: 0, totalUses: 0 });
  assert.throws(() => parseMembershipCounts('1.5 / 10회'), /정수/);
  assert.throws(() => parseMembershipCounts('11 / 10회'), /클 수 없습니다/);
});
