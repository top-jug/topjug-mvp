import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { and, count, eq } from 'drizzle-orm';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { hashVerificationToken } from '../../src/server/auth/email-verification-service';
import { auditEvents, emailVerificationChallenges, gymGrades, gyms, gymSectors, gymWalls, loginAttempts, recordShares, settingEvents, settingEventSectors, users } from '../../src/server/db/schema';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';

async function jsonRequest(path: string, init?: RequestInit) {
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

test('HTTP auth cookie, bearer ownership, and record routes', async () => {
  const database = getDatabase();
  const suffix = randomUUID();
  const email = `http-${suffix}@example.com`;
  const emailVerificationToken = randomBytes(32).toString('base64url');
  await database.insert(emailVerificationChallenges).values({
    email,
    purpose: 'register',
    codeHash: 'http-fixture',
    tokenHash: hashVerificationToken(emailVerificationToken),
    deliveredAt: new Date(),
    verifiedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const [gym] = await database.insert(gyms).values({
    name: `HTTP Gym ${suffix}`,
    address: 'Local Docker PostgreSQL',
  }).returning();
  const [grade] = await database.insert(gymGrades).values({
    gymId: gym.id,
    code: 'green',
    label: 'Green',
    color: '#00ff00',
    rank: 1,
  }).returning();
  const [wall] = await database.insert(gymWalls).values({
    gymId: gym.id,
    code: 'main',
    name: 'Main Wall',
  }).returning();
  const [sector] = await database.insert(gymSectors).values({
    gymId: gym.id,
    wallId: wall.id,
    code: 'a',
    name: 'Sector A',
  }).returning();
  const [scheduledEvent] = await database.insert(settingEvents).values({
    gymId: gym.id,
    title: 'HTTP Setting Event',
    status: 'scheduled',
    startsAt: new Date('2026-08-28T01:00:00Z'),
    endsAt: new Date('2026-08-28T03:00:00Z'),
    note: 'HTTP fixture',
  }).returning();
  await database.insert(settingEventSectors).values({ settingEventId: scheduledEvent.id, gymSectorId: sector.id, gymId: gym.id });
  await database.insert(settingEvents).values({
    gymId: gym.id,
    title: 'Completed HTTP Setting Event',
    status: 'completed',
    startsAt: new Date('2026-08-29T01:00:00Z'),
  });

  try {
    const oversized = await jsonRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ payload: 'x'.repeat(65_537) }),
    });
    assert.equal(oversized.status, 413);

    const register = await jsonRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'Correct horse battery staple1', displayName: 'HTTP Test', emailVerificationToken }),
    });
    assert.equal(register.status, 201);
    assert.equal(register.headers.get('cache-control'), 'no-store');
    assert.ok(register.headers.get('x-request-id'));
    const registerSetCookie = register.headers.get('set-cookie') ?? '';
    assert.match(registerSetCookie, /HttpOnly/i);
    assert.match(registerSetCookie, /SameSite=Strict/i);
    assert.match(registerSetCookie, /Path=\/api\/v1\/auth/i);
    assert.match(registerSetCookie, /Max-Age=\d+/i);
    const refreshCookie = registerSetCookie.split(';')[0];
    assert.match(refreshCookie ?? '', /^topjug_refresh=/);
    const registerBody = await register.json() as { data: { accessToken: string; user: { id: string } } };

    const me = await jsonRequest('/me', {
      headers: { authorization: `Bearer ${registerBody.data.accessToken}` },
    });
    assert.equal(me.status, 200);

    const unauthorizedRecentGyms = await jsonRequest('/me/recent-gyms');
    assert.equal(unauthorizedRecentGyms.status, 401);

    const authorization = { authorization: `Bearer ${registerBody.data.accessToken}` };
    const incomingRequestId = randomUUID();
    const gymList = await jsonRequest(`/gyms?q=${encodeURIComponent(suffix)}`, {
      headers: { 'x-request-id': incomingRequestId },
    });
    assert.equal(gymList.status, 200);
    assert.equal(gymList.headers.get('x-request-id'), incomingRequestId);
    const gymListBody = await gymList.json() as { data: Array<Record<string, unknown> & { id: string }> };
    assert.deepEqual(gymListBody.data.map((item) => item.id), [gym.id]);
    assert.deepEqual(Object.keys(gymListBody.data[0]!).sort(), [
      'address', 'branchName', 'brand', 'calendarColor', 'calendarTextColor', 'cover', 'dayPassPrice', 'facilities',
      'id', 'latitude', 'longitude', 'name', 'operationStatus', 'regionCode', 'tags',
    ]);

    const gymDetail = await jsonRequest(`/gyms/${gym.id}`, { headers: { 'x-request-id': 'invalid-request-id' } });
    assert.equal(gymDetail.status, 200);
    assert.match(gymDetail.headers.get('x-request-id') ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.notEqual(gymDetail.headers.get('x-request-id'), 'invalid-request-id');
    const gymDetailBody = await gymDetail.json() as { data: Record<string, unknown> & { id: string; grades: Array<{ id: string }>; walls: Array<{ id: string }> } };
    assert.equal(gymDetailBody.data.id, gym.id);
    assert.equal(gymDetailBody.data.grades[0]?.id, grade.id);
    assert.equal(gymDetailBody.data.walls[0]?.id, wall.id);

    const saveGym = () => jsonRequest(`/me/saved-gyms/${gym.id}`, { method: 'PUT', headers: authorization });
    assert.equal((await saveGym()).status, 204);
    assert.equal((await saveGym()).status, 204);
    const savedGyms = await jsonRequest('/me/saved-gyms', { headers: authorization });
    assert.equal(savedGyms.status, 200);
    const savedGymsBody = await savedGyms.json() as { data: Array<{ id: string }> };
    assert.deepEqual(savedGymsBody.data.map((item) => item.id), [gym.id]);
    const unsaveGym = () => jsonRequest(`/me/saved-gyms/${gym.id}`, { method: 'DELETE', headers: authorization });
    assert.equal((await unsaveGym()).status, 204);
    assert.equal((await unsaveGym()).status, 204);

    const eventQuery = new URLSearchParams({
      from: '2026-08-28T00:00:00Z',
      to: '2026-08-30T00:00:00Z',
      gymId: gym.id,
      status: 'scheduled',
    });
    const eventResponse = await jsonRequest(`/setting-events?${eventQuery}`);
    assert.equal(eventResponse.status, 200);
    const eventBody = await eventResponse.json() as { data: Array<Record<string, unknown> & { id: string; gym: Record<string, unknown>; sectors: Array<Record<string, unknown>> }> };
    assert.deepEqual(eventBody.data.map((event) => event.id), [scheduledEvent.id]);
    assert.deepEqual(Object.keys(eventBody.data[0]!).sort(), ['endsAt', 'gym', 'id', 'note', 'sectors', 'startsAt', 'status', 'title']);
    assert.deepEqual(Object.keys(eventBody.data[0]!.gym).sort(), ['address', 'branchName', 'calendarColor', 'calendarTextColor', 'id', 'logo', 'name']);
    assert.deepEqual(Object.keys(eventBody.data[0]!.sectors[0]!).sort(), ['code', 'id', 'isActive', 'name', 'sortOrder', 'wall']);

    const membershipInput = {
      name: 'HTTP Period Pass',
      type: 'period',
      gymIds: [gym.id],
      validFrom: new Date(Date.now() - 86_400_000).toISOString(),
      validUntil: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      note: null,
      homeFavorite: false,
    };
    const membershipResponse = await jsonRequest('/memberships', {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify(membershipInput),
    });
    assert.equal(membershipResponse.status, 201);
    const membershipBody = await membershipResponse.json() as { data: Record<string, unknown> & { id: string; updatedAt: string } };
    const publicMembershipKeys = [
      'createdAt', 'eligibilityStatus', 'gymIds', 'gyms', 'homeFavorite', 'homeOrder', 'id', 'name', 'note',
      'remainingUses', 'totalUses', 'type', 'updatedAt', 'validFrom', 'validUntil',
    ];
    assert.deepEqual(Object.keys(membershipBody.data).sort(), publicMembershipKeys);
    assert.deepEqual(membershipBody.data.gymIds, [gym.id]);
    assert.deepEqual(membershipBody.data.gyms, [{ id: gym.id, name: gym.name, branchName: gym.branchName }]);
    assert.equal(membershipBody.data.eligibilityStatus, 'active');
    assert.equal('userId' in membershipBody.data, false);
    assert.equal('archivedAt' in membershipBody.data, false);

    const membershipsList = await jsonRequest('/memberships', { headers: authorization });
    assert.equal(membershipsList.status, 200);
    const membershipsListBody = await membershipsList.json() as { data: Array<Record<string, unknown>> };
    assert.deepEqual(Object.keys(membershipsListBody.data[0]!).sort(), publicMembershipKeys);

    const replacedMembership = await jsonRequest(`/memberships/${membershipBody.data.id}`, {
      method: 'PUT',
      headers: authorization,
      body: JSON.stringify({ ...membershipInput, name: 'Updated HTTP Period Pass', expectedUpdatedAt: membershipBody.data.updatedAt }),
    });
    assert.equal(replacedMembership.status, 200);
    const replacedMembershipBody = await replacedMembership.json() as { data: Record<string, unknown> };
    assert.deepEqual(Object.keys(replacedMembershipBody.data).sort(), publicMembershipKeys);

    const staleReplacement = await jsonRequest(`/memberships/${membershipBody.data.id}`, {
      method: 'PUT',
      headers: authorization,
      body: JSON.stringify({ ...membershipInput, expectedUpdatedAt: membershipBody.data.updatedAt }),
    });
    assert.equal(staleReplacement.status, 409);
    assert.equal((await staleReplacement.json() as { error: { code: string } }).error.code, 'MEMBERSHIP_CHANGED');

    const invalidMembershipPath = await jsonRequest('/memberships/not-a-uuid', {
      method: 'DELETE',
      headers: authorization,
    });
    assert.equal(invalidMembershipPath.status, 400);
    assert.equal(invalidMembershipPath.headers.get('cache-control'), 'no-store');
    assert.ok(invalidMembershipPath.headers.get('x-request-id'));

    const created = await jsonRequest('/records', {
      method: 'POST',
      headers: { authorization: `Bearer ${registerBody.data.accessToken}` },
      body: JSON.stringify({
        gymId: gym.id,
        accessType: 'day_pass',
        startedAt: '2026-08-23T10:00:00+09:00',
        endedAt: '2026-08-23T12:00:00+09:00',
        rating: 4.5,
        mode: 'normal',
        sessionType: 'free',
        counts: [{ gymGradeId: grade.id, gymSectorId: sector.id, attempts: 5, sends: 3 }],
      }),
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { data: { id: string; sends: number; attempts: number } };
    assert.equal(createdBody.data.sends, 3);
    assert.equal(createdBody.data.attempts, 5);

    const secondCreated = await jsonRequest('/records', {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({
        gymId: gym.id,
        accessType: 'day_pass',
        startedAt: '2026-08-24T10:00:00+09:00',
        endedAt: '2026-08-24T12:00:00+09:00',
        rating: 4,
        mode: 'normal',
        sessionType: 'training',
        counts: [{ gymGradeId: grade.id, gymSectorId: sector.id, attempts: 2, sends: 1 }],
      }),
    });
    assert.equal(secondCreated.status, 201);

    const recentVisitedGyms = await jsonRequest('/me/recent-gyms', { headers: authorization });
    assert.equal(recentVisitedGyms.status, 200);
    const recentVisitedGymsBody = await recentVisitedGyms.json() as {
      data: Array<{ gym: Record<string, unknown> & { id: string }; lastVisitedAt: string }>;
    };
    assert.equal(recentVisitedGymsBody.data.length, 1);
    assert.equal(recentVisitedGymsBody.data[0]!.gym.id, gym.id);
    assert.deepEqual(Object.keys(recentVisitedGymsBody.data[0]!).sort(), ['gym', 'lastVisitedAt']);
    assert.deepEqual(Object.keys(recentVisitedGymsBody.data[0]!.gym).sort(), ['branchName', 'id', 'name']);
    assert.equal(recentVisitedGymsBody.data[0]!.lastVisitedAt, '2026-08-24T01:00:00.000Z');

    const list = await jsonRequest('/records?limit=20', {
      headers: { authorization: `Bearer ${registerBody.data.accessToken}` },
    });
    assert.equal(list.status, 200);
    const listBody = await list.json() as { data: Array<{ id: string }> };
    assert.equal(listBody.data.some((record) => record.id === createdBody.data.id), true);

    const firstPage = await jsonRequest('/records?limit=1', { headers: authorization });
    assert.equal(firstPage.status, 200);
    assert.equal(firstPage.headers.get('cache-control'), 'no-store');
    assert.ok(firstPage.headers.get('x-request-id'));
    const firstPageBody = await firstPage.json() as { data: Array<{ id: string }>; meta: { nextCursor: string | null } };
    assert.equal(firstPageBody.data.length, 1);
    assert.ok(firstPageBody.meta.nextCursor);
    const secondPage = await jsonRequest(`/records?limit=1&cursor=${encodeURIComponent(firstPageBody.meta.nextCursor!)}`, { headers: authorization });
    assert.equal(secondPage.status, 200);
    const secondPageBody = await secondPage.json() as { data: Array<{ id: string }> };
    assert.equal(secondPageBody.data.length, 1);
    assert.notEqual(secondPageBody.data[0]!.id, firstPageBody.data[0]!.id);

    const invalidCursor = await jsonRequest('/records?cursor=not-a-cursor', { headers: authorization });
    assert.equal(invalidCursor.status, 400);
    assert.deepEqual(await invalidCursor.json(), { error: { code: 'INVALID_CURSOR', message: '페이지 커서가 올바르지 않습니다.' } });
    assert.equal(invalidCursor.headers.get('cache-control'), 'no-store');
    assert.ok(invalidCursor.headers.get('x-request-id'));

    const invalidRecordPath = await jsonRequest('/records/not-a-uuid', { headers: authorization });
    assert.equal(invalidRecordPath.status, 400);
    assert.equal((await invalidRecordPath.json() as { error: { code: string } }).error.code, 'INVALID_REQUEST');

    const session = await jsonRequest('/records/sessions', {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({
        gymId: gym.id,
        accessType: 'day_pass',
        startedAt: '2026-08-25T10:00:00+09:00',
        mode: 'normal',
        sessionType: 'free',
      }),
    });
    assert.equal(session.status, 201);
    const sessionBody = await session.json() as { data: { id: string } };
    const pause = await jsonRequest(`/records/${sessionBody.data.id}/pause`, {
      method: 'POST', headers: authorization, body: JSON.stringify({ at: '2026-08-25T10:30:00+09:00' }),
    });
    assert.equal(pause.status, 200);
    const duplicatePause = await jsonRequest(`/records/${sessionBody.data.id}/pause`, {
      method: 'POST', headers: authorization, body: JSON.stringify({ at: '2026-08-25T10:35:00+09:00' }),
    });
    assert.equal(duplicatePause.status, 409);
    assert.equal((await duplicatePause.json() as { error: { code: string } }).error.code, 'RECORD_ALREADY_PAUSED');
    const resume = await jsonRequest(`/records/${sessionBody.data.id}/resume`, {
      method: 'POST', headers: authorization, body: JSON.stringify({ at: '2026-08-25T10:45:00+09:00' }),
    });
    assert.equal(resume.status, 200);
    const duplicateResume = await jsonRequest(`/records/${sessionBody.data.id}/resume`, {
      method: 'POST', headers: authorization, body: JSON.stringify({ at: '2026-08-25T10:50:00+09:00' }),
    });
    assert.equal(duplicateResume.status, 409);
    assert.equal((await duplicateResume.json() as { error: { code: string } }).error.code, 'RECORD_NOT_PAUSED');
    const complete = await jsonRequest(`/records/${sessionBody.data.id}/complete`, {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({
        endedAt: '2026-08-25T11:00:00+09:00',
        rating: 4.5,
        counts: [{ gymGradeId: grade.id, gymSectorId: sector.id, attempts: 3, sends: 2 }],
      }),
    });
    assert.equal(complete.status, 200);
    const repeatedComplete = await jsonRequest(`/records/${sessionBody.data.id}/complete`, {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({ endedAt: '2026-08-25T11:05:00+09:00', counts: [] }),
    });
    assert.equal(repeatedComplete.status, 404);
    assert.equal((await repeatedComplete.json() as { error: { code: string } }).error.code, 'ACTIVE_RECORD_NOT_FOUND');

    const cancellableSession = await jsonRequest('/records/sessions', {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({
        gymId: gym.id,
        accessType: 'day_pass',
        startedAt: '2026-08-26T10:00:00+09:00',
        mode: 'easy',
        sessionType: 'free',
      }),
    });
    assert.equal(cancellableSession.status, 201);
    const cancellableBody = await cancellableSession.json() as { data: { id: string } };
    const cancel = await jsonRequest(`/records/${cancellableBody.data.id}/cancel`, {
      method: 'POST', headers: authorization, body: JSON.stringify({ at: '2026-08-26T10:30:00+09:00' }),
    });
    assert.equal(cancel.status, 200);
    const repeatedCancel = await jsonRequest(`/records/${cancellableBody.data.id}/cancel`, {
      method: 'POST', headers: authorization, body: JSON.stringify({ at: '2026-08-26T10:35:00+09:00' }),
    });
    assert.equal(repeatedCancel.status, 404);
    assert.equal((await repeatedCancel.json() as { error: { code: string } }).error.code, 'ACTIVE_RECORD_NOT_FOUND');

    const expiringShare = await jsonRequest(`/records/${createdBody.data.id}/shares`, {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({ expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() }),
    });
    assert.equal(expiringShare.status, 201);
    const expiringShareBody = await expiringShare.json() as { data: { id: string; token: string } };
    await database.update(recordShares).set({ expiresAt: new Date(0) })
      .where(eq(recordShares.id, expiringShareBody.data.id));
    const expiredPublicShare = await jsonRequest(`/shares/${expiringShareBody.data.token}`);
    assert.equal(expiredPublicShare.status, 410);
    assert.equal((await expiredPublicShare.json() as { error: { code: string } }).error.code, 'SHARE_EXPIRED');
    assert.equal(expiredPublicShare.headers.get('cache-control'), 'no-store');
    assert.ok(expiredPublicShare.headers.get('x-request-id'));

    const revocableShare = await jsonRequest(`/records/${createdBody.data.id}/shares`, {
      method: 'POST', headers: authorization, body: JSON.stringify({}),
    });
    assert.equal(revocableShare.status, 201);
    const revocableShareBody = await revocableShare.json() as { data: { id: string; token: string } };
    const revoke = await jsonRequest(`/records/${createdBody.data.id}/shares/${revocableShareBody.data.id}`, {
      method: 'DELETE', headers: authorization,
    });
    assert.equal(revoke.status, 204);
    const revokedPublicShare = await jsonRequest(`/shares/${revocableShareBody.data.token}`);
    assert.equal(revokedPublicShare.status, 404);
    assert.equal((await revokedPublicShare.json() as { error: { code: string } }).error.code, 'SHARE_NOT_FOUND');

    const invalidSharePath = await jsonRequest('/shares/short');
    assert.equal(invalidSharePath.status, 400);
    assert.equal((await invalidSharePath.json() as { error: { code: string } }).error.code, 'INVALID_REQUEST');

    const refreshed = await jsonRequest('/auth/refresh', {
      method: 'POST',
      headers: { cookie: refreshCookie! },
    });
    assert.equal(refreshed.status, 200);
    const rotatedSetCookie = refreshed.headers.get('set-cookie') ?? '';
    assert.match(rotatedSetCookie, /HttpOnly/i);
    assert.match(rotatedSetCookie, /SameSite=Strict/i);
    assert.match(rotatedSetCookie, /Path=\/api\/v1\/auth/i);
    const rotatedCookie = rotatedSetCookie.split(';')[0];
    assert.notEqual(rotatedCookie, refreshCookie);

    const reused = await jsonRequest('/auth/refresh', {
      method: 'POST',
      headers: { cookie: refreshCookie! },
    });
    assert.equal(reused.status, 401);
    assert.equal(reused.headers.get('www-authenticate'), 'Bearer');

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const replay = await jsonRequest('/auth/refresh', {
        method: 'POST',
        headers: { cookie: refreshCookie! },
      });
      assert.equal(replay.status, 401);
    }
    const limitedReplay = await jsonRequest('/auth/refresh', {
      method: 'POST',
      headers: { cookie: refreshCookie! },
    });
    assert.equal(limitedReplay.status, 429);
    assert.equal(limitedReplay.headers.get('retry-after'), '900');

    const noOpLogout = await jsonRequest('/auth/logout', {
      method: 'POST',
      headers: { cookie: rotatedCookie! },
    });
    assert.equal(noOpLogout.status, 204);
    const [logoutAudits] = await database
      .select({ count: count() })
      .from(auditEvents)
      .where(and(eq(auditEvents.actorUserId, registerBody.data.user.id), eq(auditEvents.action, 'auth.logout')));
    assert.equal(logoutAudits.count, 0);
  } finally {
    await database.delete(emailVerificationChallenges).where(eq(emailVerificationChallenges.email, email));
    const [user] = await database.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (user) {
      await database.delete(auditEvents).where(eq(auditEvents.actorUserId, user.id));
      await database.delete(users).where(eq(users.id, user.id));
    }
    await database.delete(gyms).where(eq(gyms.id, gym.id));
    await database.delete(loginAttempts);
    await closeDatabase();
  }
});
