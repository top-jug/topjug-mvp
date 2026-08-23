import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, verifyPassword } from '../../src/server/auth/password';
import { createTokenPair, hashToken, verifyAccessToken, verifyRefreshToken } from '../../src/server/auth/token';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-bytes';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-bytes';

test('Argon2id hashes verify the original password only', async () => {
  const passwordHash = await hashPassword('correct horse battery staple');

  assert.match(passwordHash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(passwordHash, 'correct horse battery staple'), true);
  assert.equal(await verifyPassword(passwordHash, 'incorrect password'), false);
});

test('access and refresh JWTs have separate verified claims', async () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const tokens = await createTokenPair(userId);

  assert.deepEqual(await verifyAccessToken(tokens.accessToken), { userId });
  assert.deepEqual(await verifyRefreshToken(tokens.refreshToken), {
    userId,
    sessionId: tokens.sessionId,
    familyId: tokens.familyId,
  });
  await assert.rejects(() => verifyAccessToken(tokens.refreshToken));
  assert.equal(hashToken(tokens.refreshToken), hashToken(tokens.refreshToken));
  assert.notEqual(hashToken(tokens.refreshToken), tokens.refreshToken);
});
