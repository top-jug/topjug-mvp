import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '../http/api-error';
import { REFRESH_TTL_SECONDS } from './token';

export const REFRESH_COOKIE_NAME = 'topjug_refresh';

export function getRefreshCookie(request: NextRequest) {
  const token = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!token) throw new ApiError(401, 'MISSING_REFRESH_TOKEN', '세션이 만료되었습니다. 다시 로그인해주세요.');
  return token;
}

export function setRefreshCookie(response: NextResponse, token: string) {
  response.cookies.set(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

export function clearRefreshCookie(response: NextResponse) {
  response.cookies.set(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 0,
  });
}
