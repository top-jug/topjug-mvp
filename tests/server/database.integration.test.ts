import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { registerUser, rotateRefreshToken } from '../../src/server/auth/auth-service';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, gymGrades, gyms, gymSectors, gymWalls, loginAttempts, memberships, membershipUsages, users } from '../../src/server/db/schema';
import { ApiError } from '../../src/server/http/api-error';
import { runWithRequestContext } from '../../src/server/observability/request-context';
import { createRecord, getRecord, listRecords } from '../../src/server/records/record-service';
import { archiveMembership, createMembership, replaceMembership } from '../../src/server/memberships/membership-service';
import {
  completeRecordSession,
  cancelRecordSession,
  getActiveRecordSession,
  pauseRecordSession,
  replaceRecordSessionCounts,
  resumeRecordSession,
  startRecordSession,
} from '../../src/server/records/record-session-service';
import { createRecordShare, listRecordShares, revokeRecordShare } from '../../src/server/shares/share-service';

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
  const [wall] = await database.insert(gymWalls).values({ gymId: gym.id, code: 'main', name: 'Main Wall' }).returning();
  const [sector] = await database.insert(gymSectors).values({ gymId: gym.id, wallId: wall.id, code: 'a', name: 'Sector A' }).returning();

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
        accessType: 'day_pass',
        startedAt: '2026-08-23T10:00:00+09:00',
        endedAt: '2026-08-23T12:00:00+09:00',
        rating: 4.5,
        mode: 'normal',
        sessionType: 'free',
        counts: [{ gymGradeId: grade.id, gymSectorId: sector.id, attempts: 5, sends: 3 }],
      });
      assert.equal(record.sends, 3);
      assert.equal(record.attempts, 5);

      const membership = await createMembership(first.user.id, {
        name: 'Integration Count Pass',
        type: 'count',
        gymIds: [gym.id],
        totalUses: 2,
        remainingUses: 2,
        validFrom: '2026-08-01T00:00:00+09:00',
        validUntil: '2026-12-31T23:59:59+09:00',
        homeFavorite: false,
      });
      const membershipRecord = await createRecord(first.user.id, {
        gymId: gym.id,
        accessType: 'membership',
        membershipId: membership.id,
        startedAt: '2026-08-24T10:00:00+09:00',
        endedAt: '2026-08-24T12:00:00+09:00',
        rating: 4,
        mode: 'normal',
        sessionType: 'training',
        counts: [{ gymGradeId: grade.id, gymSectorId: sector.id, attempts: 4, sends: 2 }],
      });
      const [updatedMembership] = await database.select({ remainingUses: memberships.remainingUses })
        .from(memberships).where(eq(memberships.id, membership.id));
      const [usage] = await database.select().from(membershipUsages)
        .where(eq(membershipUsages.recordId, membershipRecord.id));
      assert.equal(updatedMembership.remainingUses, 1);
      assert.equal(usage.delta, -1);
      assert.equal(usage.balanceAfter, 1);
      await assert.rejects(
        () => replaceMembership(first.user.id, membership.id, {
          name: membership.name,
          type: 'period',
          gymIds: [gym.id],
          validFrom: membership.validFrom.toISOString(),
          validUntil: membership.validUntil.toISOString(),
          homeFavorite: false,
        }),
        (error: unknown) => error instanceof ApiError && error.code === 'MEMBERSHIP_TYPE_LOCKED',
      );
      await assert.rejects(
        () => replaceMembership(first.user.id, membership.id, {
          name: membership.name,
          type: 'count',
          gymIds: [],
          totalUses: 2,
          remainingUses: 1,
          validFrom: membership.validFrom.toISOString(),
          validUntil: membership.validUntil.toISOString(),
          homeFavorite: false,
        }),
        (error: unknown) => error instanceof ApiError && error.code === 'MEMBERSHIP_GYM_LOCKED',
      );

      const unusedMembership = await createMembership(first.user.id, {
        name: 'Unused Count Pass',
        type: 'count',
        gymIds: [gym.id],
        totalUses: 1,
        remainingUses: 1,
        validFrom: '2026-08-01T00:00:00+09:00',
        validUntil: '2026-12-31T23:59:59+09:00',
        homeFavorite: false,
      });
      const changedMembership = await replaceMembership(first.user.id, unusedMembership.id, {
        name: 'Unused Period Pass',
        type: 'period',
        gymIds: [gym.id],
        validFrom: '2026-08-01T00:00:00+09:00',
        validUntil: '2026-12-31T23:59:59+09:00',
        homeFavorite: false,
      });
      assert.equal(changedMembership.type, 'period');
      assert.equal(changedMembership.remainingUses, null);

      const live = await startRecordSession(first.user.id, {
        gymId: gym.id,
        accessType: 'membership',
        membershipId: membership.id,
        startedAt: '2026-08-25T10:00:00+09:00',
        mode: 'normal',
        sessionType: 'training',
      });
      assert.ok(live);
      assert.equal((await getActiveRecordSession(first.user.id))?.id, live.id);
      await assert.rejects(
        () => startRecordSession(first.user.id, {
          gymId: gym.id,
          accessType: 'day_pass',
          startedAt: '2026-08-25T10:10:00+09:00',
          mode: 'normal',
          sessionType: 'free',
        }),
        (error: unknown) => error instanceof ApiError && error.code === 'ACTIVE_RECORD_EXISTS',
      );
      const draft = await replaceRecordSessionCounts(first.user.id, live.id, {
        counts: [{ gymGradeId: grade.id, gymSectorId: sector.id, attempts: 1, sends: 0 }],
      });
      assert.equal(draft.attempts, 1);
      await assert.rejects(
        () => archiveMembership(first.user.id, membership.id),
        (error: unknown) => error instanceof ApiError && error.code === 'MEMBERSHIP_IN_USE',
      );
      await pauseRecordSession(first.user.id, live.id, new Date('2026-08-25T10:30:00+09:00'));
      await assert.rejects(
        () => cancelRecordSession(first.user.id, live.id, new Date('2026-08-25T10:20:00+09:00')),
        (error: unknown) => error instanceof ApiError && error.code === 'INVALID_CANCEL_TIME',
      );
      await resumeRecordSession(first.user.id, live.id, new Date('2026-08-25T10:45:00+09:00'));
      const completedLive = await completeRecordSession(first.user.id, live.id, {
        endedAt: '2026-08-25T11:00:00+09:00',
        rating: 4,
        counts: [{ gymGradeId: grade.id, gymSectorId: sector.id, attempts: 2, sends: 1 }],
      });
      assert.equal(completedLive.activeDurationSeconds, 2_700);
      assert.equal(completedLive.attempts, 2);
      assert.equal(await getActiveRecordSession(first.user.id), null);

      const createdShare = await createRecordShare(first.user.id, completedLive.id, {});
      const shares = await listRecordShares(first.user.id, completedLive.id);
      assert.equal(shares.data[0]?.id, createdShare.id);
      assert.equal('token' in shares.data[0]!, false);
      await revokeRecordShare(first.user.id, completedLive.id, createdShare.id);

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
