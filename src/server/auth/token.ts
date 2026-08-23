import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { ApiError } from '../http/api-error';

const ISSUER = 'topjug.kr';
const ACCESS_AUDIENCE = 'topjug-api';
const REFRESH_AUDIENCE = 'topjug-refresh';
const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

function getSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET') {
  const value = process.env[name];
  if (!value || new TextEncoder().encode(value).byteLength < 32) {
    throw new ApiError(503, 'AUTH_NOT_CONFIGURED', `${name} 설정이 필요합니다.`);
  }

  return new TextEncoder().encode(value);
}

export async function createTokenPair(userId: string, sessionId: string = randomUUID(), familyId: string = randomUUID()) {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({ tokenType: 'access' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL_SECONDS)
    .sign(getSecret('JWT_ACCESS_SECRET'));

  const refreshToken = await new SignJWT({ tokenType: 'refresh', familyId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(REFRESH_AUDIENCE)
    .setSubject(userId)
    .setJti(sessionId)
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TTL_SECONDS)
    .sign(getSecret('JWT_REFRESH_SECRET'));

  return {
    accessToken,
    accessTokenExpiresIn: ACCESS_TTL_SECONDS,
    refreshToken,
    refreshTokenExpiresAt: new Date((now + REFRESH_TTL_SECONDS) * 1000),
    sessionId,
    familyId,
  };
}

export async function verifyAccessToken(token: string) {
  const secret = getSecret('JWT_ACCESS_SECRET');

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
      algorithms: ['HS256'],
    });

    if (payload.tokenType !== 'access' || !payload.sub) throw new Error('Invalid access claims');
    return { userId: payload.sub };
  } catch {
    throw new ApiError(401, 'INVALID_ACCESS_TOKEN', '로그인이 필요합니다.');
  }
}

export async function verifyRefreshToken(token: string) {
  const secret = getSecret('JWT_REFRESH_SECRET');

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: REFRESH_AUDIENCE,
      algorithms: ['HS256'],
    });

    if (payload.tokenType !== 'refresh' || !payload.sub || !payload.jti || typeof payload.familyId !== 'string') {
      throw new Error('Invalid refresh claims');
    }

    return { userId: payload.sub, sessionId: payload.jti, familyId: payload.familyId };
  } catch {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', '세션이 만료되었습니다. 다시 로그인해주세요.');
  }
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
