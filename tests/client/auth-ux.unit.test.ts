import assert from 'node:assert/strict';
import test from 'node:test';
import { toRegisterInput, validateRegistrationPasswords } from '../../src/features/auth/registration';
import {
  AUTH_SESSION_EVENT_KEY,
  createSessionReconciler,
  isAuthenticatedSessionEvent,
  publishAuthenticatedSession,
} from '../../src/features/auth/session-events';
import { runWithAuthSessionLock, type SessionLockManager } from '../../src/lib/api/session-lock';

test('registration rejects short and mismatched passwords before submission', () => {
  assert.equal(validateRegistrationPasswords('short', 'short'), '비밀번호는 12자 이상 입력해주세요.');
  assert.equal(validateRegistrationPasswords('long-enough-password', 'different-password'), '비밀번호가 일치하지 않습니다.');
  assert.equal(validateRegistrationPasswords('long-enough-password', 'long-enough-password'), null);
});

test('registration confirmation is omitted from the API input', () => {
  assert.deepEqual(
    toRegisterInput({
      displayName: 'Climber',
      email: 'climber@example.com',
      password: 'long-enough-password',
      passwordConfirmation: 'long-enough-password',
    }),
    { displayName: 'Climber', email: 'climber@example.com', password: 'long-enough-password' },
  );
});

test('authenticated session events are uniquely published and strictly recognized', () => {
  const writes: Array<[string, string]> = [];
  publishAuthenticatedSession({ setItem: (key, value) => writes.push([key, value]) }, 'event-1');

  assert.deepEqual(writes, [[AUTH_SESSION_EVENT_KEY, '{"type":"authenticated","nonce":"event-1"}']]);
  assert.equal(isAuthenticatedSessionEvent({ key: writes[0][0], newValue: writes[0][1] }), true);
  assert.equal(isAuthenticatedSessionEvent({ key: AUTH_SESSION_EVENT_KEY, newValue: '{"type":"authenticated"}' }), false);
  assert.equal(isAuthenticatedSessionEvent({ key: 'unrelated', newValue: writes[0][1] }), false);
  assert.doesNotThrow(() => publishAuthenticatedSession({ setItem: () => { throw new Error('storage denied'); } }, 'event-2'));
});

test('storage event bursts stay dirty until one focused activation reconciles them', async () => {
  const releases: Array<() => void> = [];
  let calls = 0;
  const reconciler = createSessionReconciler(async () => {
    calls += 1;
    await new Promise<void>((resolve) => releases.push(resolve));
  });

  reconciler.markDirty();
  reconciler.markDirty();
  assert.equal(calls, 0);
  assert.equal(reconciler.isDirty(), true);

  const first = reconciler.reconcileOnActivation();
  const duplicateFocus = reconciler.reconcileOnActivation();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  assert.equal(reconciler.isDirty(), false);
  assert.equal(first, duplicateFocus);

  releases.shift()?.();
  await first;
  assert.equal(calls, 1);
});

test('an event during reconciliation stays dirty for the next activation', async () => {
  const releases: Array<() => void> = [];
  let calls = 0;
  const reconciler = createSessionReconciler(async () => {
    calls += 1;
    await new Promise<void>((resolve) => releases.push(resolve));
  });

  const first = reconciler.reconcileOnActivation();
  await new Promise((resolve) => setTimeout(resolve, 0));
  reconciler.markDirty();
  releases.shift()?.();
  await first;
  assert.equal(reconciler.isDirty(), true);

  const second = reconciler.reconcileOnActivation();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 2);
  releases.shift()?.();
  await second;
});

test('local session work can defer activation without clearing dirty state', async () => {
  let localOperation = true;
  let calls = 0;
  const reconciler = createSessionReconciler(async () => {
    calls += 1;
  }, () => !localOperation);
  reconciler.markDirty();

  await reconciler.reconcileOnActivation();
  assert.equal(calls, 0);
  assert.equal(reconciler.isDirty(), true);

  localOperation = false;
  await reconciler.reconcileOnActivation();
  assert.equal(calls, 1);
});

test('the shared auth lock serializes cookie-mutating operations', async () => {
  let queue = Promise.resolve();
  const manager: SessionLockManager = {
    request: (_name, callback) => {
      const result = queue.then(callback);
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  const order: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const first = runWithAuthSessionLock(async () => {
    order.push('first:start');
    await new Promise<void>((resolve) => { releaseFirst = resolve; });
    order.push('first:end');
  }, manager);
  const second = runWithAuthSessionLock(async () => {
    order.push('second:start');
    order.push('second:end');
  }, manager);

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(order, ['first:start']);
  releaseFirst?.();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start', 'second:end']);
});
