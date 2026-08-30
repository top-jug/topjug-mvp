import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { and, eq } from 'drizzle-orm';
import { registerUser, resetPassword, rotateRefreshToken } from '../../src/server/auth/auth-service';
import {
  confirmEmailVerification,
  hashVerificationCode,
  hashVerificationToken,
  requestEmailVerification,
} from '../../src/server/auth/email-verification-service';
import { verifyPassword } from '../../src/server/auth/password';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, emailVerificationChallenges, loginAttempts, users } from '../../src/server/db/schema';
import { ApiError } from '../../src/server/http/api-error';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-bytes';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-bytes';
process.env.AUTH_RATE_LIMIT_PEPPER = 'test-rate-limit-pepper-that-is-at-least-32-bytes';

test('email challenges enforce delivery, attempts, one-time consumption, and session revocation', async () => {
  const database = getDatabase();
  const suffix = randomUUID();
  const email = `recovery-${suffix}@example.com`;
  const failedEmail = `delivery-failure-${suffix}@example.com`;
  const attemptsEmail = `attempts-${suffix}@example.com`;
  const expiredEmail = `expired-${suffix}@example.com`;
  let userId: string | undefined;

  try {
    const expiredToken = randomBytes(32).toString('base64url');
    await database.insert(emailVerificationChallenges).values([
      {
        email: expiredEmail, purpose: 'register', codeHash: hashVerificationCode(expiredEmail, 'register', '123456'),
        deliveredAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() - 60_000),
      },
      {
        email: expiredEmail, purpose: 'reset_password', codeHash: 'expired-token', tokenHash: hashVerificationToken(expiredToken),
        deliveredAt: new Date(Date.now() - 120_000), verifiedAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000),
      },
    ]);
    await assert.rejects(
      () => confirmEmailVerification({ email: expiredEmail, purpose: 'register', code: '123456' }, `expired-code-${suffix}`),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_EMAIL_VERIFICATION',
    );
    await assert.rejects(
      () => resetPassword({ password: 'Changed1!', emailVerificationToken: expiredToken }, `expired-token-${suffix}`),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_EMAIL_VERIFICATION',
    );

    let registrationCode = '';
    const requested = await requestEmailVerification({ email, purpose: 'register' }, `request-${suffix}`, async (message) => {
      registrationCode = message.code;
    });
    assert.equal(requested.expiresIn, 600);
    assert.match(registrationCode, /^\d{6}$/);

    await assert.rejects(
      () => confirmEmailVerification({ email, purpose: 'reset_password', code: registrationCode }, `wrong-purpose-${suffix}`),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_EMAIL_VERIFICATION',
    );
    const registrationVerification = await confirmEmailVerification(
      { email, purpose: 'register', code: registrationCode },
      `confirm-${suffix}`,
    );
    const registration = await registerUser({
      email,
      displayName: 'Recovery Climber',
      password: 'Valid123',
      emailVerificationToken: registrationVerification.verificationToken,
    }, `register-${suffix}`);
    userId = registration.user.id;
    assert.ok(registration.user.emailVerifiedAt);
    await assert.rejects(
      () => registerUser({
        email: `other-${suffix}@example.com`, displayName: 'Other', password: 'Valid123',
        emailVerificationToken: registrationVerification.verificationToken,
      }, `reuse-${suffix}`),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_EMAIL_VERIFICATION',
    );

    await assert.rejects(
      () => requestEmailVerification({ email: failedEmail, purpose: 'reset_password' }, `delivery-${suffix}`, async () => {
        throw new Error('simulated delivery failure');
      }),
      (error: unknown) => error instanceof ApiError && error.code === 'EMAIL_DELIVERY_FAILED',
    );
    const [failedChallenge] = await database.select().from(emailVerificationChallenges)
      .where(eq(emailVerificationChallenges.email, failedEmail));
    assert.ok(failedChallenge.consumedAt);
    assert.equal(failedChallenge.deliveredAt, null);

    let attemptsCode = '';
    await requestEmailVerification({ email: attemptsEmail, purpose: 'register' }, `attempt-request-${suffix}`, async (message) => {
      attemptsCode = message.code;
    });
    assert.ok(attemptsCode);
    const incorrectCode = attemptsCode === '000000' ? '000001' : '000000';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await assert.rejects(
        () => confirmEmailVerification({ email: attemptsEmail, purpose: 'register', code: incorrectCode }, `attempt-${suffix}`),
        (error: unknown) => error instanceof ApiError && error.code === 'INVALID_EMAIL_VERIFICATION',
      );
    }
    const [lockedChallenge] = await database.select().from(emailVerificationChallenges)
      .where(eq(emailVerificationChallenges.email, attemptsEmail));
    assert.equal(lockedChallenge.attempts, 5);
    assert.ok(lockedChallenge.consumedAt);

    let resetCode = '';
    await requestEmailVerification({ email, purpose: 'reset_password' }, `reset-request-${suffix}`, async (message) => {
      resetCode = message.code;
    });
    const resetVerification = await confirmEmailVerification(
      { email, purpose: 'reset_password', code: resetCode },
      `reset-confirm-${suffix}`,
    );
    const resets = await Promise.allSettled([
      resetPassword({ password: 'Changed1!', emailVerificationToken: resetVerification.verificationToken }, `reset-a-${suffix}`),
      resetPassword({ password: 'Changed1!', emailVerificationToken: resetVerification.verificationToken }, `reset-b-${suffix}`),
    ]);
    assert.equal(resets.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(resets.filter((result) => result.status === 'rejected').length, 1);

    const [updatedUser] = await database.select().from(users).where(eq(users.id, userId));
    assert.equal(await verifyPassword(updatedUser.passwordHash, 'Changed1!'), true);
    await assert.rejects(
      () => rotateRefreshToken(registration.tokens.refreshToken),
      (error: unknown) => error instanceof ApiError && error.code === 'REFRESH_TOKEN_REUSED',
    );
    const resetAudits = await database.select().from(auditEvents).where(and(
      eq(auditEvents.actorUserId, userId),
      eq(auditEvents.action, 'auth.password_reset'),
    ));
    assert.equal(resetAudits.length, 1);
  } finally {
    if (userId) {
      await database.delete(auditEvents).where(eq(auditEvents.actorUserId, userId));
      await database.delete(users).where(eq(users.id, userId));
    }
    await database.delete(emailVerificationChallenges).where(eq(emailVerificationChallenges.email, email));
    await database.delete(emailVerificationChallenges).where(eq(emailVerificationChallenges.email, failedEmail));
    await database.delete(emailVerificationChallenges).where(eq(emailVerificationChallenges.email, attemptsEmail));
    await database.delete(emailVerificationChallenges).where(eq(emailVerificationChallenges.email, expiredEmail));
    await database.delete(loginAttempts);
    await closeDatabase();
  }
});
