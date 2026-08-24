import assert from 'node:assert/strict';
import test from 'node:test';
import { apiMembershipToItem, buildMembershipInput, parseMembershipCounts, validateMembershipDates } from '../../src/features/membership/membership-contract';

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

test('membership dates accept leap days and reject nonexistent calendar dates', () => {
  assert.doesNotThrow(() => validateMembershipDates('2024.02.29', '2024.03.01'));
  assert.throws(() => validateMembershipDates('2025.02.29', '2025.03.01'), /시작일에 실제 존재하는 날짜/);
  assert.throws(() => validateMembershipDates('2026.04.01', '2026.04.31'), /만료일에 실제 존재하는 날짜/);
});

test('membership dates reject malformed values and start-after-end ordering', () => {
  assert.throws(() => validateMembershipDates('2026.2.01', '2026.03.01'), /시작일은 YYYY\.MM\.DD 형식/);
  assert.throws(() => validateMembershipDates('2026.03.02', '2026.03.01'), /만료일은 시작일과 같거나 이후/);
});

test('unchanged offset-aware membership instants survive an edit exactly', () => {
  const offsetMembership = {
    ...apiMembership,
    validFrom: '2026-08-01T00:15:00+09:00',
    validUntil: '2026-09-01T23:45:00-04:00',
  };
  const item = apiMembershipToItem(offsetMembership, gymOptions);
  const input = buildMembershipInput({ ...item, note: '수정된 메모' }, gymOptions, [item]);
  assert.equal(input.validFrom, offsetMembership.validFrom);
  assert.equal(input.validUntil, offsetMembership.validUntil);
});

test('blank membership notes remain optional in the API input', () => {
  const item = apiMembershipToItem(apiMembership, gymOptions);
  const input = buildMembershipInput({ ...item, note: '' }, gymOptions, [item]);
  assert.equal(input.note, null);
});

test('membership counts accept zero and reject invalid or inverted values', () => {
  assert.deepEqual(parseMembershipCounts('0 / 0회'), { remainingUses: 0, totalUses: 0 });
  assert.throws(() => parseMembershipCounts('1.5 / 10회'), /정수/);
  assert.throws(() => parseMembershipCounts('11 / 10회'), /클 수 없습니다/);
});
