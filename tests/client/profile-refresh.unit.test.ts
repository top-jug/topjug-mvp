import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError } from '../../src/lib/api/error';
import { getProfileRefreshState, profileRefreshFailure } from '../../src/features/auth/profile-refresh';
import type { AuthUser } from '../../src/features/auth/types';

const user: AuthUser = {
  id: 'user-1',
  email: 'climber@example.com',
  displayName: 'Climber',
  homeRegionCode: null,
  emailVerifiedAt: null,
  createdAt: '2026-08-24T00:00:00.000Z',
  homeRegion: null,
  stats: { savedGyms: 2, memberships: 1, recordsThisMonth: 3 },
};

test('profile refresh state distinguishes loading, stale, error, and ready', () => {
  const error = new ApiClientError('temporary failure', 503, 'UNAVAILABLE');
  assert.equal(getProfileRefreshState(true, null, true), 'loading');
  assert.equal(getProfileRefreshState(false, error, true), 'stale');
  assert.equal(getProfileRefreshState(false, error, false), 'error');
  assert.equal(getProfileRefreshState(false, null, true), 'ready');
});

test('transient profile refresh failures preserve the existing user as stale data', () => {
  const error = new ApiClientError('temporary failure', 503, 'UNAVAILABLE');
  assert.deepEqual(profileRefreshFailure(user, error), { user, status: 'authenticated', error });
});

test('unauthorized profile refresh failures clear the user instead of presenting stale data', () => {
  const error = new ApiClientError('login required', 401, 'AUTH_REQUIRED');
  assert.deepEqual(profileRefreshFailure(user, error), { user: null, status: 'unauthenticated', error: null });
});
