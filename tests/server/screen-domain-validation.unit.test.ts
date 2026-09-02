import assert from 'node:assert/strict';
import test from 'node:test';
import { listSettingEventsSchema } from '../../src/server/calendar/setting-event-validation';
import { listGymsSchema } from '../../src/server/gyms/gym-validation';
import { membershipInputSchema, membershipUpdateInputSchema } from '../../src/server/memberships/membership-validation';
import { createShareSchema } from '../../src/server/shares/share-validation';

const gymId = '00000000-0000-4000-8000-000000000010';

test('gym search applies non-status defaults and rejects unknown filters', () => {
  assert.deepEqual(listGymsSchema.parse({}), { facility: [], tag: [], limit: 50 });
  assert.equal(listGymsSchema.safeParse({ unsupported: 'value' }).success, false);
});

test('count and period memberships enforce different persisted fields', () => {
  const base = {
    name: '30회권',
    gymIds: [gymId],
    validFrom: '2026-08-01T00:00:00+09:00',
    validUntil: '2026-12-31T23:59:59+09:00',
    homeFavorite: false,
  };
  assert.equal(membershipInputSchema.safeParse({
    ...base, type: 'count', totalUses: 30, remainingUses: 20,
  }).success, true);
  assert.equal(membershipInputSchema.safeParse({
    ...base, type: 'count', totalUses: 30, remainingUses: 31,
  }).success, false);
  assert.equal(membershipInputSchema.safeParse({
    ...base, type: 'period', totalUses: 30,
  }).success, false);
  assert.equal(membershipInputSchema.safeParse({
    ...base, type: 'period', gymIds: [],
  }).success, true);
});

test('home memberships require a valid explicit order', () => {
  const result = membershipInputSchema.safeParse({
    name: '기간권',
    type: 'period',
    gymIds: [gymId],
    validFrom: '2026-08-01T00:00:00+09:00',
    validUntil: '2026-12-31T23:59:59+09:00',
    homeFavorite: true,
  });
  assert.equal(result.success, false);
});

test('membership replacement requires a strict RFC3339 concurrency token', () => {
  const input = {
    name: '기간권',
    type: 'period',
    gymIds: [gymId],
    validFrom: '2026-08-01T00:00:00+09:00',
    validUntil: '2026-12-31T23:59:59+09:00',
    homeFavorite: false,
  };
  assert.equal(membershipInputSchema.safeParse(input).success, true);
  assert.equal(membershipUpdateInputSchema.safeParse(input).success, false);
  assert.equal(membershipUpdateInputSchema.safeParse({ ...input, expectedUpdatedAt: 'not-a-date' }).success, false);
  assert.equal(membershipUpdateInputSchema.safeParse({
    ...input,
    expectedUpdatedAt: '2026-08-24T00:00:00Z',
    unsupported: true,
  }).success, false);
  assert.equal(membershipUpdateInputSchema.safeParse({ ...input, expectedUpdatedAt: '2026-08-24T00:00:00Z' }).success, true);
});

test('setting event ranges and share expiration are validated', () => {
  assert.equal(listSettingEventsSchema.safeParse({
    from: '2026-09-01T00:00:00+09:00',
    to: '2026-08-01T00:00:00+09:00',
  }).success, false);
  assert.equal(createShareSchema.safeParse({ expiresAt: '2000-01-01T00:00:00Z' }).success, false);
});
