import assert from 'node:assert/strict';
import test from 'node:test';
import { compareHomeOrder, firstUnusedHomeOrder, MembershipItem } from '../../src/mocks/memberships';

function membership(id: string, homeOrder: number | null): MembershipItem {
  return {
    id,
    gymName: '암장',
    passName: '회원권',
    passType: 'period',
    remainingLabel: '남은 기간',
    remainingValue: '10일 남음',
    lightBg: '#fff',
    darkText: '#000',
    startDate: '2026.08.01',
    endDate: '2026.08.31',
    note: null,
    isFavorite: true,
    homeOrder,
  };
}

test('home favorites take the first unused order slot', () => {
  assert.equal(firstUnusedHomeOrder([membership('first', 0), membership('third', 2)]), 1);
});

test('home favorites are sorted by home order with unordered items last', () => {
  const memberships = [membership('unordered', null), membership('third', 2), membership('first', 0)];
  assert.deepEqual(memberships.sort(compareHomeOrder).map(({ id }) => id), ['first', 'third', 'unordered']);
});
