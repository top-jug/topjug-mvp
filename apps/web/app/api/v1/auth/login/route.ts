import { NextResponse } from 'next/server';
import { loginUser } from '../../../../../../../src/server/auth/auth-service';
import { loginSchema } from '../../../../../../../src/server/auth/auth-validation';
import { setRefreshCookie } from '../../../../../../../src/server/auth/refresh-cookie';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { getClientAddress } from '../../../../../../../src/server/http/client-address';
import { parseInput, readJson } from '../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApiHandler(async (request) => {
  const input = parseInput(loginSchema, await readJson(request));
  const { user, tokens } = await loginUser(input, getClientAddress(request));
  const response = NextResponse.json({
    data: { user, accessToken: tokens.accessToken, accessTokenExpiresIn: tokens.accessTokenExpiresIn },
  });
  response.headers.set('Cache-Control', 'no-store');
  setRefreshCookie(response, tokens.refreshToken);
  return response;
});
