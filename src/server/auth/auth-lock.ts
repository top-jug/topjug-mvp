import 'server-only';

import { sql } from 'drizzle-orm';
import type { AuthTransaction } from './email-verification-service';

export function authUserLockKey(userId: string) {
  return `auth-user-session:${userId}`;
}

export async function lockAuthUser(transaction: AuthTransaction, userId: string) {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${authUserLockKey(userId)}, 0))`);
}
