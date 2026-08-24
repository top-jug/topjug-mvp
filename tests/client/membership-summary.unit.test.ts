import assert from 'node:assert/strict';
import test from 'node:test';
import { MembershipItem } from '../../src/mocks/memberships';
import { loadMembershipResource } from '../../src/features/membership/membership-loading';
import {
  ACTIVATION_REFRESH_COALESCE_MS,
  countExpiringSoon,
  deriveMembershipPresentation,
  EXPIRING_SOON_DAYS,
  localCalendarDaysRemaining,
  millisecondsUntilNextLocalDate,
  shouldRefreshForActivation,
} from '../../src/features/membership/membership-summary';

function membership(overrides: Partial<MembershipItem> = {}): MembershipItem {
  return {
    id: 'membership-1',
    gymIds: ['gym-1'],
    gymName: '암장',
    passName: '기간권',
    passType: 'period',
    remainingLabel: '남은 기간',
    remainingValue: '99일 남음',
    lightBg: '#fff',
    darkText: '#000',
    startDate: '2026.08.01',
    endDate: '2026.08.31',
    validFrom: new Date(2026, 7, 1).toISOString(),
    validUntil: new Date(2026, 7, 31, 23, 59).toISOString(),
    note: null,
    eligibilityStatus: 'active',
    ...overrides,
  };
}

test('expiring soon means an active eligible membership ending within 14 local calendar days', () => {
  const now = new Date(2026, 7, 24, 12);
  const atThreshold = membership({ validUntil: new Date(2026, 7, 24 + EXPIRING_SOON_DAYS, 23, 59).toISOString() });
  const outsideThreshold = membership({ id: 'outside', validUntil: new Date(2026, 7, 24 + EXPIRING_SOON_DAYS + 1).toISOString() });
  const notStarted = membership({ id: 'future', validFrom: new Date(2026, 7, 25).toISOString() });
  const unassigned = membership({ id: 'unassigned', gymIds: [] });

  assert.equal(countExpiringSoon([], now), 0);
  assert.equal(countExpiringSoon([atThreshold, outsideThreshold, notStarted, unassigned], now), 1);
});

test('remaining days and eligibility recompute across a local date rollover', () => {
  const validUntil = new Date(2026, 7, 25, 23, 59).toISOString();
  const item = membership({ validUntil });
  const beforeMidnight = new Date(2026, 7, 24, 23, 59, 59);
  const afterMidnight = new Date(2026, 7, 25, 0, 0, 1);

  assert.equal(localCalendarDaysRemaining(validUntil, beforeMidnight), 1);
  assert.equal(deriveMembershipPresentation(item, beforeMidnight).remainingValue, '1일 남음');
  assert.equal(deriveMembershipPresentation(item, afterMidnight).remainingValue, '0일 남음');
  assert.equal(deriveMembershipPresentation(item, new Date(2026, 7, 26)).eligibilityStatus, 'expired');
  assert.equal(millisecondsUntilNextLocalDate(beforeMidnight), 1_000);
});

test('membership and gym-option results preserve independent partial state and retry independently', async () => {
  let membershipCalls = 0;
  let gymCalls = 0;
  const gymError = new Error('gym options unavailable');
  const [membershipResult, gymResult] = await Promise.all([
    loadMembershipResource(async () => {
      membershipCalls += 1;
      return ['membership-1'];
    }),
    loadMembershipResource(async () => {
      gymCalls += 1;
      throw gymError;
    }),
  ]);

  assert.deepEqual(membershipResult, { ok: true, data: ['membership-1'] });
  assert.deepEqual(gymResult, { ok: false, error: gymError });
  const displayedMemberships = membershipResult.ok ? membershipResult.data : [];
  const displayedGymOptions = gymResult.ok ? gymResult.data : [];
  assert.deepEqual(displayedMemberships, ['membership-1']);
  assert.deepEqual(displayedGymOptions, []);

  const recovered = await loadMembershipResource(async () => {
    gymCalls += 1;
    return ['gym-1'];
  });
  assert.deepEqual(recovered, { ok: true, data: ['gym-1'] });
  assert.deepEqual(displayedMemberships, ['membership-1']);
  assert.equal(membershipCalls, 1);
  assert.equal(gymCalls, 2);
});

test('focus and visibility activations inside the coalescing window do not trigger refresh storms', () => {
  assert.equal(shouldRefreshForActivation(10_000, 10_000 + ACTIVATION_REFRESH_COALESCE_MS - 1), false);
  assert.equal(shouldRefreshForActivation(10_000, 10_000 + ACTIVATION_REFRESH_COALESCE_MS), true);
});
