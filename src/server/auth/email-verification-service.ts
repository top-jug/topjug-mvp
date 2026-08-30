import 'server-only';

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, emailVerificationChallenges, type EmailVerificationPurpose } from '../db/schema';
import { ApiError } from '../http/api-error';
import { auditEventValues } from '../observability/audit';
import { logger } from '../observability/logger';
import type { ConfirmEmailVerificationInput, RequestEmailVerificationInput } from './auth-validation';
import { deliverEmailChallenge, type EmailChallengeDelivery } from './email-delivery';
import { consumeEmailVerificationConfirmAttempts, consumeEmailVerificationRequestAttempts } from './rate-limit';

export const EMAIL_CODE_TTL_SECONDS = 10 * 60;
export const VERIFIED_EMAIL_TOKEN_TTL_SECONDS = 15 * 60;
const MAX_CODE_ATTEMPTS = 5;

type Database = ReturnType<typeof getDatabase>;
type TransactionCallback = Parameters<Database['transaction']>[0];
export type AuthTransaction = Parameters<TransactionCallback>[0];

function getVerificationPepper() {
  const pepper = process.env.AUTH_RATE_LIMIT_PEPPER;
  if (!pepper || Buffer.byteLength(pepper) < 32) {
    throw new ApiError(503, 'AUTH_NOT_CONFIGURED', '이메일 인증 설정이 필요합니다.');
  }
  return pepper;
}

export function hashVerificationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function hashVerificationCode(email: string, purpose: EmailVerificationPurpose, code: string) {
  return createHmac('sha256', getVerificationPepper())
    .update(`email-verification:${purpose}:${email}:${code}`)
    .digest('hex');
}

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verificationLockKey(email: string, purpose: EmailVerificationPurpose) {
  return createHmac('sha256', getVerificationPepper())
    .update(`email-verification-lock:${purpose}:${email}`)
    .digest('hex');
}

function invalidVerificationError() {
  return new ApiError(400, 'INVALID_EMAIL_VERIFICATION', '인증 정보가 올바르지 않거나 만료되었습니다.');
}

export async function requestEmailVerification(
  input: RequestEmailVerificationInput,
  clientAddress: string,
  delivery: EmailChallengeDelivery = deliverEmailChallenge,
) {
  await consumeEmailVerificationRequestAttempts(input.email, input.purpose, clientAddress);
  const database = getDatabase();
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_SECONDS * 1000);
  const [challenge] = await database.insert(emailVerificationChallenges).values({
    email: input.email,
    purpose: input.purpose,
    codeHash: hashVerificationCode(input.email, input.purpose, code),
    expiresAt,
  }).returning({ id: emailVerificationChallenges.id });

  try {
    await delivery({ to: input.email, purpose: input.purpose, code });
    const delivered = await database.update(emailVerificationChallenges)
      .set({ deliveredAt: new Date() })
      .where(and(eq(emailVerificationChallenges.id, challenge.id), isNull(emailVerificationChallenges.consumedAt)))
      .returning({ id: emailVerificationChallenges.id });
    if (!delivered[0]) throw new Error('Challenge was invalidated before delivery completed');
    await database.insert(auditEvents).values(auditEventValues({
      action: 'auth.email_verification_requested',
      resourceType: 'email_verification_challenge',
      resourceId: challenge.id,
      metadata: { purpose: input.purpose },
    }));
  } catch (error) {
    try {
      await database.transaction(async (transaction) => {
        await transaction.update(emailVerificationChallenges).set({ consumedAt: new Date() })
          .where(and(eq(emailVerificationChallenges.id, challenge.id), isNull(emailVerificationChallenges.consumedAt)));
        await transaction.insert(auditEvents).values(auditEventValues({
          action: 'auth.email_verification_requested',
          outcome: 'failure',
          resourceType: 'email_verification_challenge',
          resourceId: challenge.id,
          metadata: { purpose: input.purpose, reason: 'delivery_failed' },
        }));
      });
    } catch (cleanupError) {
      logger.error('auth.email_verification_cleanup_failed', {
        errorName: cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
      });
    }
    logger.error('auth.email_verification_delivery_failed', {
      purpose: input.purpose,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    throw new ApiError(503, 'EMAIL_DELIVERY_FAILED', '인증 이메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.');
  }

  return { expiresIn: EMAIL_CODE_TTL_SECONDS };
}

export async function confirmEmailVerification(input: ConfirmEmailVerificationInput, clientAddress: string) {
  await consumeEmailVerificationConfirmAttempts(input.email, input.purpose, clientAddress);
  const database = getDatabase();
  const result = await database.transaction(async (transaction) => {
    const lockKey = verificationLockKey(input.email, input.purpose);
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
    const challenges = await transaction.select().from(emailVerificationChallenges).where(and(
      eq(emailVerificationChallenges.email, input.email),
      eq(emailVerificationChallenges.purpose, input.purpose),
      isNotNull(emailVerificationChallenges.deliveredAt),
      isNull(emailVerificationChallenges.verifiedAt),
      isNull(emailVerificationChallenges.consumedAt),
      gt(emailVerificationChallenges.expiresAt, new Date()),
    )).orderBy(desc(emailVerificationChallenges.createdAt));

    const submittedHash = hashVerificationCode(input.email, input.purpose, input.code);
    const challenge = challenges.find((candidate) => hashesMatch(candidate.codeHash, submittedHash));

    if (!challenge) {
      const newestChallenge = challenges[0];
      if (newestChallenge) {
        const attempts = newestChallenge.attempts + 1;
        await transaction.update(emailVerificationChallenges)
          .set({ attempts, consumedAt: attempts >= MAX_CODE_ATTEMPTS ? new Date() : null })
          .where(eq(emailVerificationChallenges.id, newestChallenge.id));
      }
      await transaction.insert(auditEvents).values(auditEventValues({
        action: 'auth.email_verification_confirmed', outcome: 'failure',
        resourceType: newestChallenge ? 'email_verification_challenge' : undefined,
        resourceId: newestChallenge?.id,
        metadata: { purpose: input.purpose, reason: newestChallenge ? 'invalid_code' : 'invalid' },
      }));
      return null;
    }

    const verificationToken = randomBytes(32).toString('base64url');
    const verifiedAt = new Date();
    await transaction.update(emailVerificationChallenges).set({
      verifiedAt,
      tokenHash: hashVerificationToken(verificationToken),
      expiresAt: new Date(Date.now() + VERIFIED_EMAIL_TOKEN_TTL_SECONDS * 1000),
    }).where(and(eq(emailVerificationChallenges.id, challenge.id), isNull(emailVerificationChallenges.verifiedAt)));
    await transaction.update(emailVerificationChallenges).set({ consumedAt: verifiedAt }).where(and(
      eq(emailVerificationChallenges.email, input.email),
      eq(emailVerificationChallenges.purpose, input.purpose),
      isNull(emailVerificationChallenges.verifiedAt),
      isNull(emailVerificationChallenges.consumedAt),
    ));
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'auth.email_verification_confirmed', resourceType: 'email_verification_challenge',
      resourceId: challenge.id, metadata: { purpose: input.purpose },
    }));
    return { verificationToken, expiresIn: VERIFIED_EMAIL_TOKEN_TTL_SECONDS };
  });
  if (!result) throw invalidVerificationError();
  return result;
}

export async function withConsumedEmailVerification<T>(
  purpose: EmailVerificationPurpose,
  verificationToken: string,
  operation: (transaction: AuthTransaction, email: string) => Promise<T>,
) {
  const tokenHash = hashVerificationToken(verificationToken);
  return getDatabase().transaction(async (transaction) => {
    const [challenge] = await transaction.select().from(emailVerificationChallenges).where(and(
      eq(emailVerificationChallenges.purpose, purpose),
      eq(emailVerificationChallenges.tokenHash, tokenHash),
      isNotNull(emailVerificationChallenges.verifiedAt),
      isNull(emailVerificationChallenges.consumedAt),
      gt(emailVerificationChallenges.expiresAt, new Date()),
    )).limit(1);
    if (!challenge) throw invalidVerificationError();

    const consumed = await transaction.update(emailVerificationChallenges).set({ consumedAt: new Date() }).where(and(
      eq(emailVerificationChallenges.id, challenge.id),
      isNull(emailVerificationChallenges.consumedAt),
    )).returning({ id: emailVerificationChallenges.id });
    if (!consumed[0]) throw invalidVerificationError();
    return operation(transaction, challenge.email);
  });
}
