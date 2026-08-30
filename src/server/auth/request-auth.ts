import 'server-only';

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { users } from '../db/schema';
import { ApiError } from '../http/api-error';
import { verifyAccessToken } from './token';
import { setRequestActor } from '../observability/request-context';

export async function requireUser(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) throw new ApiError(401, 'MISSING_ACCESS_TOKEN', '로그인이 필요합니다.');
  const identity = await verifyAccessToken(match[1]);
  setRequestActor(identity.userId);
  return identity;
}

export async function requireOperationsAdmin(request: NextRequest) {
  const identity = await requireUser(request);
  const [user] = await getDatabase()
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, identity.userId))
    .limit(1);

  if (user?.role !== 'operations_admin') {
    throw new ApiError(403, 'OPERATIONS_ADMIN_REQUIRED', '운영 관리자 권한이 필요합니다.');
  }

  return { ...identity, role: user.role };
}
