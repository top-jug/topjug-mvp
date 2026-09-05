import { NextResponse } from 'next/server';
import { rotateRefreshToken } from '../../../../../../../src/server/auth/auth-service';
import { getRefreshCookie, setRefreshCookie } from '../../../../../../../src/server/auth/refresh-cookie';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { getClientAddress } from '../../../../../../../src/server/http/client-address';
import { consumeRefreshAttempts } from '../../../../../../../src/server/auth/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApiHandler(async (request) => {
  const refreshToken = getRefreshCookie(request);
  await consumeRefreshAttempts(getClientAddress(request), refreshToken);
  const tokens = await rotateRefreshToken(refreshToken);
  const response = NextResponse.json({
    data: { accessToken: tokens.accessToken, accessTokenExpiresIn: tokens.accessTokenExpiresIn },
  });
  response.headers.set('Cache-Control', 'no-store');
  setRefreshCookie(response, tokens.refreshToken);
  return response;
});
