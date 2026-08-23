import 'server-only';

import { sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { ApiError } from '../http/api-error';

const REQUIRED_SECRETS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'AUTH_RATE_LIMIT_PEPPER'] as const;

export async function assertReady() {
  const invalidSecret = REQUIRED_SECRETS.find((name) => {
    const value = process.env[name];
    return !value || Buffer.byteLength(value) < 32;
  });
  if (invalidSecret) {
    throw new ApiError(503, 'SERVICE_NOT_READY', '서비스 설정이 준비되지 않았습니다.');
  }

  try {
    await getDatabase().execute(sql`select 1`);
  } catch {
    throw new ApiError(503, 'SERVICE_NOT_READY', '데이터베이스 연결이 준비되지 않았습니다.');
  }
}
