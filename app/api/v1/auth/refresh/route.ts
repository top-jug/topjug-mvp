import { NextResponse } from 'next/server';
import { rotateRefreshToken } from '../../../../../src/server/auth/auth-service';
import { getRefreshCookie, setRefreshCookie } from '../../../../../src/server/auth/refresh-cookie';
import { withApiHandler } from '../../../../../src/server/http/with-api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApiHandler(async (request) => {
  const tokens = await rotateRefreshToken(getRefreshCookie(request));
  const response = NextResponse.json({
    data: { accessToken: tokens.accessToken, accessTokenExpiresIn: tokens.accessTokenExpiresIn },
  });
  response.headers.set('Cache-Control', 'no-store');
  setRefreshCookie(response, tokens.refreshToken);
  return response;
});
