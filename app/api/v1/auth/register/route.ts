import { NextResponse } from 'next/server';
import { registerUser } from '../../../../../src/server/auth/auth-service';
import { registerSchema } from '../../../../../src/server/auth/auth-validation';
import { setRefreshCookie } from '../../../../../src/server/auth/refresh-cookie';
import { withApiHandler } from '../../../../../src/server/http/with-api-handler';
import { getClientAddress } from '../../../../../src/server/http/client-address';
import { parseInput, readJson } from '../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApiHandler(async (request) => {
  const input = parseInput(registerSchema, await readJson(request));
  const { user, tokens } = await registerUser(input, getClientAddress(request));
  const response = NextResponse.json({
    data: { user, accessToken: tokens.accessToken, accessTokenExpiresIn: tokens.accessTokenExpiresIn },
  }, { status: 201 });
  response.headers.set('Cache-Control', 'no-store');
  setRefreshCookie(response, tokens.refreshToken);
  return response;
});
