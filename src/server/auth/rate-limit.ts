import 'server-only';

import { createHmac } from 'node:crypto';
import { count, eq, lt, sql } from 'drizzle-orm';
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
    await transaction.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, windowStart));
    for (const limit of hashedLimits) {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${limit.keyHash}, 0))`);
    }
    for (const limit of hashedLimits) {
      const [result] = await transaction
        .select({ attempts: count() })
        .from(loginAttempts)
        .where(eq(loginAttempts.keyHash, limit.keyHash));

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
  const hashes = await consumeAttempts([
    { value: `login:address:${clientAddress}`, maxAttempts: 30, errorCode: 'LOGIN_RATE_LIMITED' },
    { value: emailKey, maxAttempts: 5, errorCode: 'LOGIN_RATE_LIMITED' },
  ]);
  return hashes.get(emailKey)!;
}

export async function consumeRegistrationAttempts(clientAddress: string) {
  await consumeAttempts([
    { value: 'register:global', maxAttempts: 100, errorCode: 'REGISTRATION_RATE_LIMITED' },
    { value: `register:address:${clientAddress}`, maxAttempts: 10, errorCode: 'REGISTRATION_RATE_LIMITED' },
  ]);
}

export async function clearLoginFailures(keyHash: string) {
  await getDatabase().delete(loginAttempts).where(eq(loginAttempts.keyHash, keyHash));
}
