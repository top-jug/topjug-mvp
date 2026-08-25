import 'server-only';

import { sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { ApiError } from '../http/api-error';

const REQUIRED_SECRETS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'AUTH_RATE_LIMIT_PEPPER'] as const;
const REQUIRED_PUBLIC_URLS = ['MEDIA_PUBLIC_BASE_URL', 'SHARE_PUBLIC_BASE_URL'] as const;

export async function assertReady() {
  const invalidSecret = REQUIRED_SECRETS.find((name) => {
    const value = process.env[name];
    return !value || Buffer.byteLength(value) < 32;
  });
  if (invalidSecret) {
    throw new ApiError(503, 'SERVICE_NOT_READY', '서비스 설정이 준비되지 않았습니다.');
  }

  if (process.env.APP_PROFILE === 'production') {
    try {
      const emailFromAddress = process.env.EMAIL_FROM_ADDRESS ?? '';
      if (!emailFromAddress.includes('@') || emailFromAddress.length > 254) throw new Error();
    } catch {
      throw new ApiError(503, 'SERVICE_NOT_READY', '이메일 발송 설정이 준비되지 않았습니다.');
    }

    const invalidPublicUrl = REQUIRED_PUBLIC_URLS.find((name) => {
      const value = process.env[name];
      if (!value) return true;
      try {
        return new URL(value).protocol !== 'https:';
      } catch {
        return true;
      }
    });
    if (invalidPublicUrl) {
      throw new ApiError(503, 'SERVICE_NOT_READY', '공개 URL 설정이 준비되지 않았습니다.');
    }

    try {
      const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
      const sslMode = databaseUrl.searchParams.get('sslmode');
      if (
        databaseUrl.protocol !== 'postgresql:' ||
        decodeURIComponent(databaseUrl.username) !== 'topjug_app' ||
        !['require', 'verify-full'].includes(sslMode ?? '')
      ) throw new Error();
    } catch {
      throw new ApiError(503, 'SERVICE_NOT_READY', '데이터베이스 보안 설정이 준비되지 않았습니다.');
    }
  }

  try {
    await getDatabase().execute(sql`select 1 from gyms limit 1`);
    await getDatabase().execute(sql`select 1 from media_assets limit 1`);
    await getDatabase().execute(sql`select 1 from email_verification_challenges limit 1`);
  } catch {
    throw new ApiError(503, 'SERVICE_NOT_READY', '데이터베이스 연결이 준비되지 않았습니다.');
  }
}
