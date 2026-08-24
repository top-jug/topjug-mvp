import assert from 'node:assert/strict';
import test from 'node:test';
import { toRegisterInput, validateRegistrationPasswords } from '../../src/features/auth/registration';
import {
  AUTH_SESSION_EVENT_KEY,
  createSessionReconciler,
  isSessionStateEvent,
  publishAuthenticatedSession,
} from '../../src/features/auth/session-events';
import {
  acquireStorageLease,
  AUTH_SESSION_LEASE_PREFIX,
  AuthSessionLockError,
  runWithAuthSessionLock,
  type SessionLockManager,
} from '../../src/lib/api/session-lock';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function controlledWait() {
  const waiters: Array<() => void> = [];
  return {
    wait: (_signal: AbortSignal) => new Promise<void>((resolve) => waiters.push(resolve)),
    wake: () => waiters.splice(0).forEach((resolve) => resolve()),
  };
}

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
  assert.equal(isSessionStateEvent({ key: writes[0][0], newValue: writes[0][1] }), true);
  assert.equal(isSessionStateEvent({ key: AUTH_SESSION_EVENT_KEY, newValue: '{"type":"authenticated"}' }), false);
  assert.equal(isSessionStateEvent({ key: 'unrelated', newValue: writes[0][1] }), false);
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

test('dirty events during reconciliation schedule exactly one active follow-up', async () => {
  const releases: Array<() => void> = [];
  let calls = 0;
  const reconciler = createSessionReconciler(async () => {
    calls += 1;
    await new Promise<void>((resolve) => releases.push(resolve));
  });

  const first = reconciler.reconcileBootstrap();
  await new Promise((resolve) => setTimeout(resolve, 0));
  reconciler.markDirty();
  reconciler.markDirty();
  releases.shift()?.();
  await first;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 2);
  releases.shift()?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 2);
  assert.equal(reconciler.isDirty(), false);
});

test('dirty follow-up waits when the document is no longer active', async () => {
  let active = true;
  let calls = 0;
  let release: (() => void) | undefined;
  const reconciler = createSessionReconciler(async () => {
    calls += 1;
    await new Promise<void>((resolve) => { release = resolve; });
  }, () => active);

  const first = reconciler.reconcileBootstrap();
  await new Promise((resolve) => setTimeout(resolve, 0));
  reconciler.markDirty();
  active = false;
  release?.();
  await first;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  assert.equal(reconciler.isDirty(), true);

  active = true;
  const second = reconciler.reconcileOnActivation();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 2);
  release?.();
  await second;
});

test('clean activation is a no-op after bootstrap', async () => {
  let calls = 0;
  const reconciler = createSessionReconciler(async () => { calls += 1; });

  await reconciler.reconcileBootstrap();
  await reconciler.reconcileOnActivation();
  await reconciler.reconcileOnActivation();
  assert.equal(calls, 1);
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
    request: (_name, _options, callback) => {
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

test('the auth lock preserves protected operation errors', async () => {
  const expected = new Error('operation failed');
  await assert.rejects(runWithAuthSessionLock(async () => { throw expected; }), (error) => error === expected);
});

test('storage leases enforce contention and release ownership', async () => {
  const storage = new MemoryStorage();
  const waiter = controlledWait();
  const signal = new AbortController().signal;
  const releaseFirst = await acquireStorageLease({ storage, owner: 'first', now: () => 0, wait: waiter.wait }, signal);
  let secondAcquired = false;
  const second = acquireStorageLease({ storage, owner: 'second', now: () => 0, wait: waiter.wait }, signal).then((release) => {
    secondAcquired = true;
    return release;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(secondAcquired, false);

  releaseFirst();
  waiter.wake();
  const releaseSecond = await second;
  assert.equal(secondAcquired, true);
  releaseSecond();
  assert.equal(storage.length, 0);
});

test('storage leases ignore expired contenders and verify ownership', async () => {
  const storage = new MemoryStorage();
  storage.setItem(`${AUTH_SESSION_LEASE_PREFIX}expired`, JSON.stringify({ owner: 'expired', choosing: false, ticket: 1, expiresAt: 10 }));
  const release = await acquireStorageLease({ storage, owner: 'current', now: () => 20 }, new AbortController().signal);
  assert.equal(storage.getItem(`${AUTH_SESSION_LEASE_PREFIX}expired`), null);
  release();

  const waiter = controlledWait();
  const releaseBlocker = await acquireStorageLease({ storage, owner: 'blocker', now: () => 20, wait: waiter.wait }, new AbortController().signal);
  const contender = acquireStorageLease({ storage, owner: 'contender', now: () => 20, wait: waiter.wait }, new AbortController().signal);
  await new Promise((resolve) => setTimeout(resolve, 0));
  storage.setItem(`${AUTH_SESSION_LEASE_PREFIX}contender`, JSON.stringify({ owner: 'other', choosing: false, ticket: 99, expiresAt: 100 }));
  releaseBlocker();
  waiter.wake();
  await assert.rejects(contender, AuthSessionLockError);
});

test('timed out fallback operations abort and release their lease', async () => {
  const storage = new MemoryStorage();
  const failingManager: SessionLockManager = {
    request: async () => { throw new Error('Web Locks unavailable'); },
  };
  let aborted = false;

  await assert.rejects(
    runWithAuthSessionLock(
      (signal) => new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => {
        aborted = true;
        reject(signal.reason);
      }, { once: true })),
      failingManager,
      { storage, owner: 'timeout-owner', now: Date.now },
      0,
    ),
    AuthSessionLockError,
  );
  assert.equal(aborted, true);
  assert.equal(storage.length, 0);
});
