import assert from 'node:assert/strict';
import test from 'node:test';
import { operationsAccessDecision } from '../../apps/admin/src/features/operations/operations-access';

test('operations console access reflects authentication and role state', () => {
  assert.equal(operationsAccessDecision('loading', null), 'loading');
  assert.equal(operationsAccessDecision('error', null), 'auth-error');
  assert.equal(operationsAccessDecision('unauthenticated', null), 'login');
  assert.equal(operationsAccessDecision('authenticated', 'user'), 'forbidden');
  assert.equal(operationsAccessDecision('authenticated', 'operations_admin'), 'verify');
});
