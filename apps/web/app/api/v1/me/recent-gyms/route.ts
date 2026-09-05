import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { listRecentVisitedGyms } from '../../../../../../../src/server/records/recent-visited-gym-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  const { userId } = await requireUser(request);
  return NextResponse.json(await listRecentVisitedGyms(userId));
});
