import assert from 'node:assert/strict';
import test from 'node:test';
import { toRegisterInput, validateRegistrationPasswords } from '../../src/features/auth/registration';
import {
  isValidVerificationEmail,
  maskEmail,
  normalizeVerificationEmail,
} from '../../src/features/auth/email-verification';
import { getPasswordRequirementState } from '../../src/lib/auth/password-policy';
import {
  AUTH_SESSION_EVENT_KEY,
  canUseSessionStorage,
  createSessionReconciler,
  isSessionStateEvent,
  publishAuthenticatedSession,
  shouldForceActivationReconciliation,
} from '../../src/features/auth/session-events';
import {
  acquireStorageLease,
  AUTH_SESSION_LEASE_MS,
  AUTH_SESSION_LEASE_PREFIX,
  AuthSessionLockError,
  AUTH_SESSION_TIMEOUT_MS,
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

test('registration enforces password length, composition, and confirmation before submission', () => {
  assert.equal(validateRegistrationPasswords('Ab1!', 'Ab1!'), '비밀번호는 8자 이상 입력해주세요.');
  assert.equal(
    validateRegistrationPasswords('abcdefgh', 'abcdefgh'),
    '비밀번호에 영문 대문자, 숫자, 특수문자 중 2가지 이상을 포함해주세요.',
  );
  assert.equal(validateRegistrationPasswords('ABCDEF12', 'ABCDEF12'), null);
  assert.equal(validateRegistrationPasswords('ABCDEF!!', 'ABCDEF!!'), null);
  assert.equal(validateRegistrationPasswords('123456!!', '123456!!'), null);
  assert.equal(validateRegistrationPasswords('Valid123', 'Different1'), '비밀번호가 일치하지 않습니다.');
});

test('registration confirmation is omitted from the API input', () => {
  assert.deepEqual(
    toRegisterInput({
      displayName: 'Climber',
      email: 'climber@example.com',
      password: 'Valid123',
      passwordConfirmation: 'Valid123',
      emailVerificationToken: 'v'.repeat(43),
    }),
    { displayName: 'Climber', email: 'climber@example.com', password: 'Valid123', emailVerificationToken: 'v'.repeat(43) },
  );
});

test('frontend email verification normalizes, validates, and masks account emails', () => {
  assert.equal(normalizeVerificationEmail('  Climber@Example.COM '), 'climber@example.com');
  assert.equal(isValidVerificationEmail('climber@example.com'), true);
  assert.equal(isValidVerificationEmail('not-an-email'), false);
  assert.equal(maskEmail('climber@example.com'), 'cl*****@example.com');
});

test('password requirement state reports live length and composition progress', () => {
  assert.deepEqual(getPasswordRequirementState('test1234'), {
    hasMinimumLength: true,
    hasUppercase: false,
    hasDigit: true,
    hasSpecialCharacter: false,
    satisfiedCompositionCount: 1,
    hasRequiredComposition: false,
  });
  assert.deepEqual(getPasswordRequirementState('Test1234!'), {
    hasMinimumLength: true,
    hasUppercase: true,
    hasDigit: true,
    hasSpecialCharacter: true,
    satisfiedCompositionCount: 3,
    hasRequiredComposition: true,
  });
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

test('forced reconciliation retries after a clean bootstrap failure', async () => {
  let calls = 0;
  const reconciler = createSessionReconciler(async () => {
    calls += 1;
    if (calls === 1) throw new Error('bootstrap failed');
  });

  await assert.rejects(reconciler.reconcileBootstrap(), /bootstrap failed/);
  await reconciler.forceReconciliation();
  assert.equal(calls, 2);
});

test('storage-unavailable activation is forced only when Web Locks can serialize it', () => {
  const unavailable = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
    removeItem: () => { throw new Error('denied'); },
  };
  assert.equal(canUseSessionStorage(unavailable), false);
  assert.equal(shouldForceActivationReconciliation(false, true), true);
  assert.equal(shouldForceActivationReconciliation(false, false), false);
  assert.equal(shouldForceActivationReconciliation(true, true), false);
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
  const firstLease = await acquireStorageLease({ storage, owner: 'first', now: () => 0, wait: waiter.wait }, signal);
  let secondAcquired = false;
  const second = acquireStorageLease({ storage, owner: 'second', now: () => 0, wait: waiter.wait }, signal).then((release) => {
    secondAcquired = true;
    return release;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(secondAcquired, false);

  firstLease.release();
  waiter.wake();
  const secondLease = await second;
  assert.equal(secondAcquired, true);
  secondLease.release();
  assert.equal(storage.length, 0);
});

test('storage leases ignore expired contenders and verify ownership', async () => {
  const storage = new MemoryStorage();
  storage.setItem(`${AUTH_SESSION_LEASE_PREFIX}expired`, JSON.stringify({ owner: 'expired', choosing: false, ticket: 1, expiresAt: 10 }));
  const lease = await acquireStorageLease({ storage, owner: 'current', now: () => 20 }, new AbortController().signal);
  assert.equal(storage.getItem(`${AUTH_SESSION_LEASE_PREFIX}expired`), null);
  lease.release();

  const waiter = controlledWait();
  const blockerLease = await acquireStorageLease({ storage, owner: 'blocker', now: () => 20, wait: waiter.wait }, new AbortController().signal);
  const contender = acquireStorageLease({ storage, owner: 'contender', now: () => 20, wait: waiter.wait }, new AbortController().signal);
  await new Promise((resolve) => setTimeout(resolve, 0));
  storage.setItem(`${AUTH_SESSION_LEASE_PREFIX}contender`, JSON.stringify({ owner: 'other', choosing: false, ticket: 99, expiresAt: 100 }));
  blockerLease.release();
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

test('fallback heartbeat renews the lease beyond the request timeout and stops cleanly', async () => {
  assert.ok(AUTH_SESSION_LEASE_MS > AUTH_SESSION_TIMEOUT_MS * 2);
  const storage = new MemoryStorage();
  const failingManager: SessionLockManager = { request: async () => { throw new Error('unavailable'); } };
  let now = 0;
  let heartbeat: (() => void) | undefined;
  let stopped = false;
  let finish: (() => void) | undefined;
  const operation = runWithAuthSessionLock(
    async () => new Promise<void>((resolve) => { finish = resolve; }),
    failingManager,
    {
      storage,
      owner: 'renew-owner',
      now: () => now,
      leaseMs: 100,
      scheduleHeartbeat: (callback) => {
        heartbeat = callback;
        return () => { stopped = true; };
      },
    },
    1_000,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  const key = `${AUTH_SESSION_LEASE_PREFIX}renew-owner`;
  assert.equal(JSON.parse(storage.getItem(key) ?? '{}').expiresAt, 100);

  now = 40;
  heartbeat?.();
  assert.equal(JSON.parse(storage.getItem(key) ?? '{}').expiresAt, 140);
  finish?.();
  await operation;
  assert.equal(stopped, true);
  assert.equal(storage.length, 0);
});

test('fallback heartbeat aborts on ownership loss without deleting the new owner', async () => {
  const storage = new MemoryStorage();
  const failingManager: SessionLockManager = { request: async () => { throw new Error('unavailable'); } };
  let heartbeat: (() => void) | undefined;
  let stopped = false;
  let aborted = false;
  const operation = runWithAuthSessionLock(
    (signal) => new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => {
      aborted = true;
      reject(signal.reason);
    }, { once: true })),
    failingManager,
    {
      storage,
      owner: 'lost-owner',
      now: () => 0,
      leaseMs: 100,
      scheduleHeartbeat: (callback) => {
        heartbeat = callback;
        return () => { stopped = true; };
      },
    },
    1_000,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  const key = `${AUTH_SESSION_LEASE_PREFIX}lost-owner`;
  storage.setItem(key, JSON.stringify({ owner: 'replacement', choosing: false, ticket: 99, expiresAt: 100 }));
  heartbeat?.();

  await assert.rejects(operation, AuthSessionLockError);
  assert.equal(aborted, true);
  assert.equal(stopped, true);
  assert.equal(JSON.parse(storage.getItem(key) ?? '{}').owner, 'replacement');
});

test('browser fallback fails closed when storage cannot provide a lease', async () => {
  const failingManager: SessionLockManager = {
    request: async () => { throw new Error('Web Locks unavailable'); },
  };
  const storage = {
    get length(): number { throw new Error('denied'); },
    key: () => null,
    getItem: () => null,
    setItem: () => { throw new Error('denied'); },
    removeItem: () => undefined,
  };
  let ran = false;
  await assert.rejects(
    runWithAuthSessionLock(async () => { ran = true; }, failingManager, { storage, owner: 'blocked' }, 10),
    AuthSessionLockError,
  );
  assert.equal(ran, false);
});
