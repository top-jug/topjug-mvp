import { NextResponse } from 'next/server';
import { requireOperationsAdmin } from '../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../src/server/http/with-api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  const identity = await requireOperationsAdmin(request);
  const response = NextResponse.json({ data: identity });
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
