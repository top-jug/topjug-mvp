import { NextResponse } from 'next/server';
import { getUser } from '../../../../../../src/server/auth/auth-service';
import { requireUser } from '../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../src/server/http/with-api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  const { userId } = await requireUser(request);
  const response = NextResponse.json({ data: await getUser(userId) });
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
