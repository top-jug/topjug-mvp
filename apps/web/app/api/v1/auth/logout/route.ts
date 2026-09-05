import { NextResponse } from 'next/server';
import { revokeRefreshToken } from '../../../../../../../src/server/auth/auth-service';
import { clearRefreshCookie, REFRESH_COOKIE_NAME } from '../../../../../../../src/server/auth/refresh-cookie';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { getClientAddress } from '../../../../../../../src/server/http/client-address';
import { consumeLogoutAttempts } from '../../../../../../../src/server/auth/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApiHandler(async (request) => {
  const token = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (token) {
    await consumeLogoutAttempts(getClientAddress(request), token);
    await revokeRefreshToken(token);
  }
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Cache-Control', 'no-store');
  clearRefreshCookie(response);
  return response;
});
