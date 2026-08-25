import 'server-only';

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { emailVerificationChallenges, type EmailVerificationPurpose } from '../db/schema';
import { ApiError } from '../http/api-error';
import { logger } from '../observability/logger';
import type { ConfirmEmailVerificationInput, RequestEmailVerificationInput } from './auth-validation';
import { consumeEmailVerificationConfirmAttempts, consumeEmailVerificationRequestAttempts } from './rate-limit';

const CODE_TTL_MS = 10 * 60 * 1000;
const VERIFIED_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
let emailClient: SESv2Client | undefined;

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

function getEmailSender() {
  const fromEmailAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!fromEmailAddress) throw new ApiError(503, 'EMAIL_NOT_CONFIGURED', '이메일 발송 설정이 필요합니다.');
  return fromEmailAddress;
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

function emailCopy(purpose: EmailVerificationPurpose, code: string) {
  const title = purpose === 'register'
    ? '회원가입 이메일 인증'
    : purpose === 'find_account'
      ? '가입 이메일 확인'
      : '비밀번호 재설정';
  return {
    subject: `[TOPJUG] ${title} 인증번호`,
    body: `${title} 인증번호는 ${code}입니다.\n\n인증번호는 10분 동안 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해주세요.`,
  };
}

async function sendVerificationEmail(email: string, purpose: EmailVerificationPurpose, code: string) {
  const fromEmailAddress = getEmailSender();
  const copy = emailCopy(purpose, code);
  emailClient ??= new SESv2Client({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
  await emailClient.send(new SendEmailCommand({
    FromEmailAddress: fromEmailAddress,
    Destination: { ToAddresses: [email] },
    Content: {
      Simple: {
        Subject: { Data: copy.subject, Charset: 'UTF-8' },
        Body: { Text: { Data: copy.body, Charset: 'UTF-8' } },
      },
    },
  }));
}

function verificationLockKey(email: string, purpose: EmailVerificationPurpose) {
  return createHmac('sha256', getVerificationPepper())
    .update(`email-verification-lock:${purpose}:${email}`)
    .digest('hex');
}

function invalidVerificationError() {
  return new ApiError(400, 'INVALID_EMAIL_VERIFICATION', '인증번호가 올바르지 않거나 만료되었습니다.');
}

export async function requestEmailVerification(input: RequestEmailVerificationInput, clientAddress: string) {
  getEmailSender();
  await consumeEmailVerificationRequestAttempts(input.email, clientAddress);
  const database = getDatabase();
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const [challenge] = await database.transaction(async (transaction) => {
    const lockKey = verificationLockKey(input.email, input.purpose);
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
    await transaction
      .update(emailVerificationChallenges)
      .set({ consumedAt: new Date() })
      .where(and(
        eq(emailVerificationChallenges.email, input.email),
        eq(emailVerificationChallenges.purpose, input.purpose),
        isNull(emailVerificationChallenges.consumedAt),
      ));
    return transaction.insert(emailVerificationChallenges).values({
      email: input.email,
      purpose: input.purpose,
      codeHash: hashVerificationCode(input.email, input.purpose, code),
      expiresAt,
    }).returning({ id: emailVerificationChallenges.id });
  });

  try {
    await sendVerificationEmail(input.email, input.purpose, code);
  } catch (error) {
    await database.delete(emailVerificationChallenges).where(eq(emailVerificationChallenges.id, challenge.id));
    logger.error('auth.email_verification_delivery_failed', {
      purpose: input.purpose,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }

  return { expiresIn: CODE_TTL_MS / 1000 };
}

export async function confirmEmailVerification(input: ConfirmEmailVerificationInput, clientAddress: string) {
  await consumeEmailVerificationConfirmAttempts(input.email, clientAddress);
  const database = getDatabase();
  const result = await database.transaction(async (transaction) => {
    const lockKey = verificationLockKey(input.email, input.purpose);
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
    const [challenge] = await transaction
      .select()
      .from(emailVerificationChallenges)
      .where(and(
        eq(emailVerificationChallenges.email, input.email),
        eq(emailVerificationChallenges.purpose, input.purpose),
        isNull(emailVerificationChallenges.verifiedAt),
        isNull(emailVerificationChallenges.consumedAt),
        gt(emailVerificationChallenges.expiresAt, new Date()),
      ))
      .orderBy(desc(emailVerificationChallenges.createdAt))
      .limit(1);

    if (!challenge || challenge.attempts >= MAX_CODE_ATTEMPTS) return null;
    const submittedHash = hashVerificationCode(input.email, input.purpose, input.code);
    if (!hashesMatch(challenge.codeHash, submittedHash)) {
      const attempts = challenge.attempts + 1;
      await transaction
        .update(emailVerificationChallenges)
        .set({ attempts, consumedAt: attempts >= MAX_CODE_ATTEMPTS ? new Date() : null })
        .where(eq(emailVerificationChallenges.id, challenge.id));
      return null;
    }

    const verificationToken = randomBytes(32).toString('base64url');
    await transaction
      .update(emailVerificationChallenges)
      .set({
        verifiedAt: new Date(),
        tokenHash: hashVerificationToken(verificationToken),
        expiresAt: new Date(Date.now() + VERIFIED_TOKEN_TTL_MS),
      })
      .where(eq(emailVerificationChallenges.id, challenge.id));
    return { verificationToken, expiresIn: VERIFIED_TOKEN_TTL_MS / 1000 };
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
    const [challenge] = await transaction
      .select()
      .from(emailVerificationChallenges)
      .where(and(
        eq(emailVerificationChallenges.purpose, purpose),
        eq(emailVerificationChallenges.tokenHash, tokenHash),
        isNull(emailVerificationChallenges.consumedAt),
        gt(emailVerificationChallenges.expiresAt, new Date()),
      ))
      .limit(1);
    if (!challenge?.verifiedAt) throw invalidVerificationError();

    const consumed = await transaction
      .update(emailVerificationChallenges)
      .set({ consumedAt: new Date() })
      .where(and(eq(emailVerificationChallenges.id, challenge.id), isNull(emailVerificationChallenges.consumedAt)))
      .returning({ id: emailVerificationChallenges.id });
    if (!consumed[0]) throw invalidVerificationError();
    return operation(transaction, challenge.email);
  });
}
