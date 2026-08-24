import assert from 'node:assert/strict';
import test from 'node:test';
import { toRegisterInput, validateRegistrationPasswords } from '../../src/features/auth/registration';
import {
  AUTH_SESSION_EVENT_KEY,
  createSessionEventSynchronizer,
  isAuthenticatedSessionEvent,
  publishAuthenticatedSession,
} from '../../src/features/auth/session-events';

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

test('session event synchronization coalesces bursts without dropping the latest revalidation', async () => {
  const releases: Array<() => void> = [];
  let calls = 0;
  const synchronize = createSessionEventSynchronizer(async () => {
    calls += 1;
    await new Promise<void>((resolve) => releases.push(resolve));
  });

  synchronize();
  synchronize();
  synchronize();
  assert.equal(calls, 1);

  releases.shift()?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 2);

  releases.shift()?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 2);
});
