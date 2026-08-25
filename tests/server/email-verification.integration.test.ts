import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { findAccount, registerUser, resetPassword } from '../../src/server/auth/auth-service';
import { confirmEmailVerification, hashVerificationCode, hashVerificationToken } from '../../src/server/auth/email-verification-service';
import { verifyPassword } from '../../src/server/auth/password';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, emailVerificationChallenges, loginAttempts, refreshSessions, users } from '../../src/server/db/schema';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-bytes';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-bytes';
process.env.AUTH_RATE_LIMIT_PEPPER = 'test-rate-limit-pepper-that-is-at-least-32-bytes';

function verificationFixture(email: string, purpose: 'register' | 'find_account' | 'reset_password') {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    values: {
      email,
      purpose,
      codeHash: 'integration-fixture',
      tokenHash: hashVerificationToken(token),
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    },
  };
}

test('verified registration, account recovery, and password reset consume one-time database tokens', async () => {
  const database = getDatabase();
  const email = `recovery-${randomUUID()}@example.com`;
  const attemptEmail = `attempt-${randomUUID()}@example.com`;
  const registration = verificationFixture(email, 'register');
  let userId: string | undefined;

  try {
    await database.insert(emailVerificationChallenges).values({
      email: attemptEmail,
      purpose: 'register',
      codeHash: hashVerificationCode(attemptEmail, 'register', '123456'),
      expiresAt: new Date(Date.now() + 60_000),
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await assert.rejects(
        () => confirmEmailVerification({ email: attemptEmail, purpose: 'register', code: '654321' }, 'invalid-code-integration'),
        (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INVALID_EMAIL_VERIFICATION',
      );
    }
    const [lockedChallenge] = await database.select().from(emailVerificationChallenges)
      .where(eq(emailVerificationChallenges.email, attemptEmail));
    assert.equal(lockedChallenge.attempts, 5);
    assert.ok(lockedChallenge.consumedAt);

    await database.insert(emailVerificationChallenges).values(registration.values);
    const registered = await registerUser({
      email,
      displayName: 'Recovery Climber',
      password: 'Valid123',
      emailVerificationToken: registration.token,
    }, 'email-verification-integration');
    userId = registered.user.id;
    assert.ok(registered.user.emailVerifiedAt);

    const [registrationChallenge] = await database.select().from(emailVerificationChallenges)
      .where(eq(emailVerificationChallenges.tokenHash, hashVerificationToken(registration.token)));
    assert.ok(registrationChallenge.consumedAt);

    const accountRecovery = verificationFixture(email, 'find_account');
    await database.insert(emailVerificationChallenges).values(accountRecovery.values);
    assert.deepEqual(await findAccount({
      displayName: 'Recovery Climber',
      emailVerificationToken: accountRecovery.token,
    }), { email });

    const passwordReset = verificationFixture(email, 'reset_password');
    await database.insert(emailVerificationChallenges).values(passwordReset.values);
    await resetPassword({ password: 'Changed1!', emailVerificationToken: passwordReset.token }, 'email-verification-integration');

    const [updatedUser] = await database.select().from(users).where(eq(users.id, userId));
    assert.equal(await verifyPassword(updatedUser.passwordHash, 'Changed1!'), true);
    assert.equal(await verifyPassword(updatedUser.passwordHash, 'Valid123'), false);
    const sessions = await database.select().from(refreshSessions).where(eq(refreshSessions.userId, userId));
    assert.ok(sessions.length > 0);
    assert.equal(sessions.every((session) => session.revokedAt !== null), true);
  } finally {
    if (userId) {
      await database.delete(auditEvents).where(eq(auditEvents.actorUserId, userId));
      await database.delete(users).where(eq(users.id, userId));
    }
    await database.delete(emailVerificationChallenges).where(eq(emailVerificationChallenges.email, email));
    await database.delete(emailVerificationChallenges).where(eq(emailVerificationChallenges.email, attemptEmail));
    await database.delete(loginAttempts);
    await closeDatabase();
  }
});
