import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { registerUser, rotateRefreshToken } from '../../src/server/auth/auth-service';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, gymGrades, gyms, loginAttempts, users } from '../../src/server/db/schema';
import { ApiError } from '../../src/server/http/api-error';
import { runWithRequestContext } from '../../src/server/observability/request-context';
import { createRecord, getRecord, listRecords } from '../../src/server/records/record-service';

test('database-backed auth, refresh concurrency, and record ownership flow', async () => {
  const database = getDatabase();
  const requestId = randomUUID();
  const suffix = randomUUID();
  const [gym] = await database.insert(gyms).values({
    name: `Integration Gym ${suffix}`,
    address: 'Local Docker PostgreSQL',
  }).returning();
  const [grade] = await database.insert(gymGrades).values({
    gymId: gym.id,
    code: 'blue',
    label: 'Blue',
    color: '#0000ff',
    rank: 1,
  }).returning();

  try {
    await runWithRequestContext({ requestId }, async () => {
      const first = await registerUser({
        email: `first-${suffix}@example.com`,
        password: 'correct horse battery staple',
        displayName: 'First',
      }, 'integration-first');
      const second = await registerUser({
        email: `second-${suffix}@example.com`,
        password: 'correct horse battery staple',
        displayName: 'Second',
      }, 'integration-second');

      const rotations = await Promise.allSettled([
        rotateRefreshToken(first.tokens.refreshToken),
        rotateRefreshToken(first.tokens.refreshToken),
      ]);
      const rotated = rotations.find((result) => result.status === 'fulfilled');
      const duplicate = rotations.find((result) => result.status === 'rejected');
      assert.ok(rotated && rotated.status === 'fulfilled');
      assert.ok(duplicate && duplicate.status === 'rejected');
      assert.ok(duplicate.reason instanceof ApiError);
      assert.equal(duplicate.reason.code, 'REFRESH_TOKEN_REUSED');
      await assert.rejects(
        () => rotateRefreshToken(rotated.value.refreshToken),
        (error: unknown) => error instanceof ApiError && error.code === 'REFRESH_TOKEN_REUSED',
      );

      const record = await createRecord(first.user.id, {
        gymId: gym.id,
        startedAt: '2026-08-23T10:00:00+09:00',
        endedAt: '2026-08-23T12:00:00+09:00',
        rating: 4.5,
        mode: 'normal',
        counts: [{ gymGradeId: grade.id, attempts: 5, sends: 3 }],
      });
      assert.equal(record.sends, 3);
      assert.equal(record.attempts, 5);

      const page = await listRecords(first.user.id, { limit: 20 });
      assert.equal(page.data.some((item) => item.id === record.id), true);
      await assert.rejects(
        () => getRecord(second.user.id, record.id),
        (error: unknown) => error instanceof ApiError && error.code === 'RECORD_NOT_FOUND',
      );
    });
  } finally {
    await database.delete(auditEvents).where(eq(auditEvents.requestId, requestId));
    await database.delete(users).where(eq(users.email, `first-${suffix}@example.com`));
    await database.delete(users).where(eq(users.email, `second-${suffix}@example.com`));
    await database.delete(gyms).where(eq(gyms.id, gym.id));
    await database.delete(loginAttempts);
    await closeDatabase();
  }
});
