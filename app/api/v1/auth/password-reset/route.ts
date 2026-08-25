import { NextResponse } from 'next/server';
import { resetPassword } from '../../../../../src/server/auth/auth-service';
import { resetPasswordSchema } from '../../../../../src/server/auth/auth-validation';
import { clearRefreshCookie } from '../../../../../src/server/auth/refresh-cookie';
import { getClientAddress } from '../../../../../src/server/http/client-address';
import { withApiHandler } from '../../../../../src/server/http/with-api-handler';
import { parseInput, readJson } from '../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApiHandler(async (request) => {
  const input = parseInput(resetPasswordSchema, await readJson(request));
  await resetPassword(input, getClientAddress(request));
  const response = new NextResponse(null, { status: 204 });
  clearRefreshCookie(response);
  return response;
});
