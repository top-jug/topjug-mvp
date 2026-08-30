import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { and, eq, isNull } from 'drizzle-orm';
import postgres from 'postgres';
import { authUserLockKey } from '../../src/server/auth/auth-lock';
import { registerUser, resetPassword, rotateRefreshToken } from '../../src/server/auth/auth-service';
import { hashVerificationToken } from '../../src/server/auth/email-verification-service';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, emailVerificationChallenges, refreshSessions, users } from '../../src/server/db/schema';
import { ApiError } from '../../src/server/http/api-error';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-bytes';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-bytes';
process.env.AUTH_RATE_LIMIT_PEPPER = 'test-rate-limit-pepper-that-is-at-least-32-bytes';

async function waitForQueuedUserLocks(client: postgres.Sql, blockerPid: number, expected: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [row] = await client<{ count: number }[]>`
      select count(distinct waiting.pid)::int as count
      from pg_locks held
      join pg_locks waiting
        on waiting.locktype = held.locktype
       and waiting.database is not distinct from held.database
       and waiting.classid is not distinct from held.classid
       and waiting.objid is not distinct from held.objid
       and waiting.objsubid is not distinct from held.objsubid
      where held.pid = ${blockerPid}
        and held.granted
        and not waiting.granted
    `;
    if (row.count >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${expected} queued auth user locks`);
}

test('password reset queued behind refresh revokes the newly rotated session', async () => {
  const database = getDatabase();
  const email = `refresh-reset-race-${randomUUID()}@example.com`;
  const registerToken = randomBytes(32).toString('base64url');
  const resetToken = randomBytes(32).toString('base64url');
  const rawClient = postgres(process.env.DATABASE_URL!, { max: 2 });
  let userId: string | undefined;

  try {
    await database.insert(emailVerificationChallenges).values([
      {
        email, purpose: 'register', codeHash: 'register-fixture', tokenHash: hashVerificationToken(registerToken),
        deliveredAt: new Date(), verifiedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
      },
      {
        email, purpose: 'reset_password', codeHash: 'reset-fixture', tokenHash: hashVerificationToken(resetToken),
        deliveredAt: new Date(), verifiedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    const registration = await registerUser({
      email, displayName: 'Race Climber', password: 'Valid123', emailVerificationToken: registerToken,
    }, `register-${randomUUID()}`);
    userId = registration.user.id;

    let rotationPromise!: ReturnType<typeof rotateRefreshToken>;
    let resetPromise!: ReturnType<typeof resetPassword>;
    await rawClient.begin(async (blocker) => {
      const [backend] = await blocker<{ pid: number }[]>`select pg_backend_pid()::int as pid`;
      await blocker`select pg_advisory_xact_lock(hashtextextended(${authUserLockKey(userId!)}, 0))`;

      rotationPromise = rotateRefreshToken(registration.tokens.refreshToken);
      await waitForQueuedUserLocks(rawClient, backend.pid, 1);
      resetPromise = resetPassword({ password: 'Changed1!', emailVerificationToken: resetToken }, `reset-${randomUUID()}`);
      await waitForQueuedUserLocks(rawClient, backend.pid, 2);
    });

    const rotated = await rotationPromise;
    await resetPromise;
    const activeSessions = await database.select().from(refreshSessions).where(and(
      eq(refreshSessions.userId, userId),
      isNull(refreshSessions.revokedAt),
    ));
    assert.equal(activeSessions.length, 0);
    await assert.rejects(
      () => rotateRefreshToken(rotated.refreshToken),
      (error: unknown) => error instanceof ApiError && error.code === 'REFRESH_TOKEN_REUSED',
    );
  } finally {
    await rawClient.end();
    if (userId) {
      await database.delete(auditEvents).where(eq(auditEvents.actorUserId, userId));
      await database.delete(users).where(eq(users.id, userId));
    }
    await database.delete(emailVerificationChallenges).where(eq(emailVerificationChallenges.email, email));
    await closeDatabase();
  }
});
