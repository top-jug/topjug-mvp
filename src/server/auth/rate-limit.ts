import 'server-only';

import { createHmac } from 'node:crypto';
import { and, count, eq, gte, inArray, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { loginAttempts } from '../db/schema';
import { ApiError } from '../http/api-error';

const WINDOW_MS = 15 * 60 * 1000;

function getRateLimitKey(value: string) {
  const pepper = process.env.AUTH_RATE_LIMIT_PEPPER;
  if (!pepper || Buffer.byteLength(pepper) < 32) {
    throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'AUTH_RATE_LIMIT_PEPPER 설정이 필요합니다.');
  }

  return createHmac('sha256', pepper).update(value).digest('hex');
}

interface AttemptLimit {
  value: string;
  maxAttempts: number;
  errorCode: string;
}

async function consumeAttempts(limits: AttemptLimit[]) {
  const database = getDatabase();
  const windowStart = new Date(Date.now() - WINDOW_MS);
  const hashedLimits = limits
    .map((limit) => ({ ...limit, keyHash: getRateLimitKey(limit.value) }))
    .sort((left, right) => left.keyHash.localeCompare(right.keyHash));
  await database.transaction(async (transaction) => {
    for (const limit of hashedLimits) {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${limit.keyHash}, 0))`);
    }
    for (const limit of hashedLimits) {
      const [result] = await transaction
        .select({ attempts: count() })
        .from(loginAttempts)
        .where(and(eq(loginAttempts.keyHash, limit.keyHash), gte(loginAttempts.attemptedAt, windowStart)));

      if (result.attempts >= limit.maxAttempts) {
        throw new ApiError(429, limit.errorCode, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      }
    }
    await transaction.insert(loginAttempts).values(hashedLimits.map(({ keyHash }) => ({ keyHash })));
  });

  return new Map(hashedLimits.map((limit) => [limit.value, limit.keyHash]));
}

export async function consumeLoginAttempts(email: string, clientAddress: string) {
  const emailKey = `login:email:${email}`;
  const addressKey = `login:address:${clientAddress}`;
  const hashes = await consumeAttempts([
    { value: addressKey, maxAttempts: 30, errorCode: 'LOGIN_RATE_LIMITED' },
    { value: emailKey, maxAttempts: 5, errorCode: 'LOGIN_RATE_LIMITED' },
  ]);
  return [hashes.get(emailKey)!, hashes.get(addressKey)!];
}

export async function consumeRegistrationAttempts(clientAddress: string) {
  await consumeAttempts([
    { value: `register:address:${clientAddress}`, maxAttempts: 10, errorCode: 'REGISTRATION_RATE_LIMITED' },
  ]);
}

export async function consumeRefreshAttempts(clientAddress: string, refreshToken: string) {
  await consumeAttempts([
    { value: `refresh:address:${clientAddress}`, maxAttempts: 60, errorCode: 'REFRESH_RATE_LIMITED' },
    { value: `refresh:token:${refreshToken}`, maxAttempts: 10, errorCode: 'REFRESH_RATE_LIMITED' },
  ]);
}

export async function consumeLogoutAttempts(clientAddress: string, refreshToken: string) {
  await consumeAttempts([
    { value: `logout:address:${clientAddress}`, maxAttempts: 60, errorCode: 'LOGOUT_RATE_LIMITED' },
    { value: `logout:token:${refreshToken}`, maxAttempts: 10, errorCode: 'LOGOUT_RATE_LIMITED' },
  ]);
}

export async function consumeEmailVerificationRequestAttempts(email: string, clientAddress: string) {
  await consumeAttempts([
    { value: `email-verification-request:address:${clientAddress}`, maxAttempts: 20, errorCode: 'EMAIL_VERIFICATION_RATE_LIMITED' },
    { value: `email-verification-request:email:${email}`, maxAttempts: 3, errorCode: 'EMAIL_VERIFICATION_RATE_LIMITED' },
  ]);
}

export async function consumeEmailVerificationConfirmAttempts(email: string, clientAddress: string) {
  await consumeAttempts([
    { value: `email-verification-confirm:address:${clientAddress}`, maxAttempts: 30, errorCode: 'EMAIL_VERIFICATION_RATE_LIMITED' },
    { value: `email-verification-confirm:email:${email}`, maxAttempts: 10, errorCode: 'EMAIL_VERIFICATION_RATE_LIMITED' },
  ]);
}

export async function consumePasswordResetAttempts(clientAddress: string) {
  await consumeAttempts([
    { value: `password-reset:address:${clientAddress}`, maxAttempts: 10, errorCode: 'PASSWORD_RESET_RATE_LIMITED' },
  ]);
}

export async function clearLoginAttempts(keyHashes: string[]) {
  await getDatabase().delete(loginAttempts).where(inArray(loginAttempts.keyHash, keyHashes));
}
