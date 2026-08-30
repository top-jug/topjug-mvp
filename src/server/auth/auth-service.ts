import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { and, count, eq, gte, isNull } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, climbingRecords, memberships, refreshSessions, regions, savedGyms, users } from '../db/schema';
import { ApiError } from '../http/api-error';
import { hashPassword, verifyPassword } from './password';
import { clearLoginAttempts, consumeLoginAttempts, consumePasswordResetAttempts, consumeRegistrationAttempts } from './rate-limit';
import { createTokenPair, hashToken, verifyRefreshToken } from './token';
import { LoginInput, RegisterInput, ResetPasswordInput } from './auth-validation';
import { auditEventValues, writeAuditEvent, writeRequiredAuditEvent } from '../observability/audit';
import { setRequestActor } from '../observability/request-context';
import { withConsumedEmailVerification } from './email-verification-service';

function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    homeRegionCode: user.homeRegionCode,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

export async function registerUser(input: RegisterInput, clientAddress: string) {
  await consumeRegistrationAttempts(clientAddress);
  const passwordHash = await hashPassword(input.password);

  try {
    const result = await withConsumedEmailVerification('register', input.emailVerificationToken, async (transaction, verifiedEmail) => {
      if (verifiedEmail !== input.email) return null;
      const emailVerifiedAt = new Date();
      const [createdUser] = await transaction
        .insert(users)
        .values({ email: input.email, displayName: input.displayName, passwordHash, emailVerifiedAt })
        .returning();
      const createdTokens = await createTokenPair(createdUser.id);
      await transaction.insert(refreshSessions).values({
        id: createdTokens.sessionId,
        familyId: createdTokens.familyId,
        userId: createdUser.id,
        tokenHash: hashToken(createdTokens.refreshToken),
        expiresAt: createdTokens.refreshTokenExpiresAt,
      });
      await transaction.insert(auditEvents).values(auditEventValues({
        action: 'auth.register',
        actorUserId: createdUser.id,
        resourceType: 'user',
        resourceId: createdUser.id,
      }));
      return { user: createdUser, tokens: createdTokens };
    });
    if (!result) throw new ApiError(400, 'INVALID_EMAIL_VERIFICATION', '인증한 이메일과 회원가입 이메일이 일치하지 않습니다.');
    const { user, tokens } = result;
    setRequestActor(user.id);
    return { user: publicUser(user), tokens };
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      throw new ApiError(409, 'ACCOUNT_UNAVAILABLE', '이 이메일로 계정을 만들 수 없습니다.');
    }
    throw error;
  }
}

export async function resetPassword(input: ResetPasswordInput, clientAddress: string) {
  await consumePasswordResetAttempts(clientAddress);
  const passwordHash = await hashPassword(input.password);
  return withConsumedEmailVerification('reset_password', input.emailVerificationToken, async (transaction, email) => {
    const [user] = await transaction.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      await transaction.insert(auditEvents).values(auditEventValues({
        action: 'auth.password_reset', outcome: 'failure', metadata: { reason: 'account_unavailable' },
      }));
      return;
    }

    const now = new Date();
    await transaction.update(users).set({ passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? now, updatedAt: now })
      .where(eq(users.id, user.id));
    await transaction.update(refreshSessions).set({ revokedAt: now })
      .where(and(eq(refreshSessions.userId, user.id), isNull(refreshSessions.revokedAt)));
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'auth.password_reset', actorUserId: user.id, resourceType: 'user', resourceId: user.id,
    }));
    setRequestActor(user.id);
  });
}

export async function loginUser(input: LoginInput, clientAddress: string) {
  const database = getDatabase();
  const rateLimitKeys = await consumeLoginAttempts(input.email, clientAddress);
  const rows = await database.select().from(users).where(eq(users.email, input.email)).limit(1);
  const user = rows[0];
  const passwordMatches = await verifyPassword(user?.passwordHash ?? null, input.password);

  if (!user || !passwordMatches) {
    await writeRequiredAuditEvent({ action: 'auth.login', outcome: 'failure', metadata: { reason: 'invalid_credentials' } });
    throw new ApiError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호를 확인해주세요.');
  }

  await clearLoginAttempts(rateLimitKeys);
  const tokens = await createTokenPair(user.id);
  await database.transaction(async (transaction) => {
    await transaction.insert(refreshSessions).values({
      id: tokens.sessionId,
      familyId: tokens.familyId,
      userId: user.id,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: tokens.refreshTokenExpiresAt,
    });
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'auth.login',
      actorUserId: user.id,
      resourceType: 'user',
      resourceId: user.id,
    }));
  });
  setRequestActor(user.id);
  return { user: publicUser(user), tokens };
}

function tokenHashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function rotateRefreshToken(refreshToken: string) {
  const claims = await verifyRefreshToken(refreshToken);
  setRequestActor(claims.userId);
  const currentHash = hashToken(refreshToken);
  const nextTokens = await createTokenPair(claims.userId, undefined, claims.familyId);
  const database = getDatabase();

  const result = await database.transaction(async (transaction) => {
    const rows = await transaction
      .select()
      .from(refreshSessions)
      .where(and(eq(refreshSessions.id, claims.sessionId), eq(refreshSessions.userId, claims.userId)))
      .limit(1);
    const session = rows[0];
    const isReusable = session
      && !session.revokedAt
      && session.expiresAt > new Date()
      && session.familyId === claims.familyId
      && tokenHashesMatch(session.tokenHash, currentHash);

    if (!isReusable) {
      await transaction
        .update(refreshSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshSessions.familyId, claims.familyId), isNull(refreshSessions.revokedAt)));
      await transaction.insert(auditEvents).values(auditEventValues({
        action: 'auth.refresh',
        outcome: 'failure',
        actorUserId: claims.userId,
        resourceType: 'refresh_session',
        resourceId: claims.sessionId,
        metadata: { reason: 'token_reused' },
      }));
      return { reused: true as const };
    }

    const revoked = await transaction
      .update(refreshSessions)
      .set({ revokedAt: new Date(), replacedBySessionId: nextTokens.sessionId })
      .where(and(eq(refreshSessions.id, session.id), isNull(refreshSessions.revokedAt)))
      .returning({ id: refreshSessions.id });

    if (!revoked[0]) {
      await transaction
        .update(refreshSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshSessions.familyId, claims.familyId), isNull(refreshSessions.revokedAt)));
      await transaction.insert(auditEvents).values(auditEventValues({
        action: 'auth.refresh',
        outcome: 'failure',
        actorUserId: claims.userId,
        resourceType: 'refresh_session',
        resourceId: claims.sessionId,
        metadata: { reason: 'token_reused' },
      }));
      return { reused: true as const };
    }

    await transaction.insert(refreshSessions).values({
      id: nextTokens.sessionId,
      familyId: nextTokens.familyId,
      userId: claims.userId,
      tokenHash: hashToken(nextTokens.refreshToken),
      expiresAt: nextTokens.refreshTokenExpiresAt,
    });
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'auth.refresh',
      actorUserId: claims.userId,
      resourceType: 'refresh_session',
      resourceId: nextTokens.sessionId,
    }));
    return { reused: false as const };
  });

  if (result.reused) {
    throw new ApiError(401, 'REFRESH_TOKEN_REUSED', '세션 보안을 위해 다시 로그인해주세요.');
  }

  return nextTokens;
}

export async function revokeRefreshToken(refreshToken: string) {
  let claims;

  try {
    claims = await verifyRefreshToken(refreshToken);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_REFRESH_TOKEN') return false;
    throw error;
  }

  setRequestActor(claims.userId);
  return getDatabase().transaction(async (transaction) => {
    const revoked = await transaction
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(refreshSessions.id, claims.sessionId),
        eq(refreshSessions.tokenHash, hashToken(refreshToken)),
        isNull(refreshSessions.revokedAt),
      ))
      .returning({ id: refreshSessions.id });
    if (!revoked[0]) return false;
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'auth.logout',
      actorUserId: claims.userId,
      resourceType: 'refresh_session',
      resourceId: claims.sessionId,
    }));
    return true;
  });
}

export async function getUser(userId: string) {
  const database = getDatabase();
  const rows = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0]) throw new ApiError(404, 'USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [homeRegion, savedGymCount, membershipCount, monthlyRecordCount] = await Promise.all([
    rows[0].homeRegionCode
      ? database.select({ code: regions.code, name: regions.name, parentCode: regions.parentCode })
        .from(regions).where(eq(regions.code, rows[0].homeRegionCode)).limit(1)
      : Promise.resolve([]),
    database.select({ total: count() }).from(savedGyms).where(eq(savedGyms.userId, userId)),
    database.select({ total: count() }).from(memberships).where(and(eq(memberships.userId, userId), isNull(memberships.archivedAt))),
    database.select({ total: count() }).from(climbingRecords).where(and(
      eq(climbingRecords.userId, userId),
      eq(climbingRecords.status, 'completed'),
      gte(climbingRecords.startedAt, monthStart),
    )),
  ]);
  await writeAuditEvent({ action: 'user.read', resourceType: 'user', resourceId: userId });
  return {
    ...publicUser(rows[0]),
    homeRegion: homeRegion[0] ?? null,
    stats: {
      savedGyms: savedGymCount[0].total,
      memberships: membershipCount[0].total,
      recordsThisMonth: monthlyRecordCount[0].total,
    },
  };
}
