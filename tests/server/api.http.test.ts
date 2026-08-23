import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { and, count, eq } from 'drizzle-orm';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, gymGrades, gyms, gymSectors, gymWalls, loginAttempts, users } from '../../src/server/db/schema';

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

  try {
    const oversized = await jsonRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ payload: 'x'.repeat(65_537) }),
    });
    assert.equal(oversized.status, 413);

    const register = await jsonRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'correct horse battery staple', displayName: 'HTTP Test' }),
    });
    assert.equal(register.status, 201);
    assert.equal(register.headers.get('cache-control'), 'no-store');
    assert.ok(register.headers.get('x-request-id'));
    const refreshCookie = register.headers.get('set-cookie')?.split(';')[0];
    assert.match(refreshCookie ?? '', /^topjug_refresh=/);
    const registerBody = await register.json() as { data: { accessToken: string; user: { id: string } } };

    const me = await jsonRequest('/me', {
      headers: { authorization: `Bearer ${registerBody.data.accessToken}` },
    });
    assert.equal(me.status, 200);

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

    const list = await jsonRequest('/records?limit=20', {
      headers: { authorization: `Bearer ${registerBody.data.accessToken}` },
    });
    assert.equal(list.status, 200);
    const listBody = await list.json() as { data: Array<{ id: string }> };
    assert.equal(listBody.data.some((record) => record.id === createdBody.data.id), true);

    const refreshed = await jsonRequest('/auth/refresh', {
      method: 'POST',
      headers: { cookie: refreshCookie! },
    });
    assert.equal(refreshed.status, 200);
    const rotatedCookie = refreshed.headers.get('set-cookie')?.split(';')[0];
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
