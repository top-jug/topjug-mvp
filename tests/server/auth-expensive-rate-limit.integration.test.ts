import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';
import { inArray } from 'drizzle-orm';
import { registerUser, resetPassword } from '../../src/server/auth/auth-service';
import {
  consumePasswordResetAttempts,
  consumeRegistrationAttempts,
  PASSWORD_RESET_GLOBAL_ATTEMPTS,
  REGISTRATION_GLOBAL_ATTEMPTS,
} from '../../src/server/auth/rate-limit';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { loginAttempts } from '../../src/server/db/schema';
import { ApiError } from '../../src/server/http/api-error';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-bytes';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-bytes';
const rateLimitPepper = `test-expensive-operation-rate-limit-${randomUUID()}`;
process.env.AUTH_RATE_LIMIT_PEPPER = rateLimitPepper;

function keyHash(value: string) {
  return createHmac('sha256', rateLimitPepper).update(value).digest('hex');
}

test('distributed registration and reset hashing is globally bounded without cross-purpose interference', async () => {
  const database = getDatabase();
  const suffix = randomUUID();
  const registrationAddresses = Array.from(
    { length: REGISTRATION_GLOBAL_ATTEMPTS + 10 },
    (_, index) => `distributed-register-${suffix}-${index}`,
  );
  const resetAddresses = Array.from(
    { length: PASSWORD_RESET_GLOBAL_ATTEMPTS + 10 },
    (_, index) => `distributed-reset-${suffix}-${index}`,
  );
  const cleanupHashes = [
    keyHash('register:global'),
    keyHash('password-reset:global'),
    ...registrationAddresses.map((address) => keyHash(`register:address:${address}`)),
    ...resetAddresses.map((address) => keyHash(`password-reset:address:${address}`)),
  ];

  try {
    const registrationAttempts = await Promise.allSettled(
      registrationAddresses.map((address) => consumeRegistrationAttempts(address)),
    );
    assert.equal(registrationAttempts.filter((result) => result.status === 'fulfilled').length, REGISTRATION_GLOBAL_ATTEMPTS);
    assert.equal(registrationAttempts.every((result) => (
      result.status === 'fulfilled'
      || (result.reason instanceof ApiError && result.reason.code === 'REGISTRATION_RATE_LIMITED')
    )), true);

    // Registration exhaustion must not consume the independently scoped reset budget.
    await consumePasswordResetAttempts(resetAddresses[0]);
    await assert.rejects(
      () => registerUser({
        email: `rate-limited-${suffix}@example.com`,
        displayName: 'Rate Limited',
        password: 'Valid123',
        emailVerificationToken: 'invalid-verification-token'.padEnd(43, 'x'),
      }, `distributed-register-${suffix}-overflow`),
      (error: unknown) => error instanceof ApiError && error.code === 'REGISTRATION_RATE_LIMITED',
    );

    const resetAttempts = await Promise.allSettled(
      resetAddresses.slice(1).map((address) => consumePasswordResetAttempts(address)),
    );
    assert.equal(
      resetAttempts.filter((result) => result.status === 'fulfilled').length + 1,
      PASSWORD_RESET_GLOBAL_ATTEMPTS,
    );
    assert.equal(resetAttempts.every((result) => (
      result.status === 'fulfilled'
      || (result.reason instanceof ApiError && result.reason.code === 'PASSWORD_RESET_RATE_LIMITED')
    )), true);
    await assert.rejects(
      () => resetPassword({
        password: 'Changed1!',
        emailVerificationToken: 'invalid-verification-token'.padEnd(43, 'x'),
      }, `distributed-reset-${suffix}-overflow`),
      (error: unknown) => error instanceof ApiError && error.code === 'PASSWORD_RESET_RATE_LIMITED',
    );
  } finally {
    await database.delete(loginAttempts).where(inArray(loginAttempts.keyHash, cleanupHashes));
    await closeDatabase();
  }
});
