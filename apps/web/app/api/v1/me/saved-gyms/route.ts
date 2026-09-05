import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../../../src/server/auth/request-auth';
import { listSavedGyms } from '../../../../../../../src/server/gyms/saved-gym-service';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  const { userId } = await requireUser(request);
  return NextResponse.json(await listSavedGyms(userId));
});
