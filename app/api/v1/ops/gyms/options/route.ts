import { NextResponse } from 'next/server';
import { requireOperationsAdmin } from '../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../src/server/http/with-api-handler';
import { listOperationsGymOptions } from '../../../../../../src/server/operations/operations-gym-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  await requireOperationsAdmin(request);
  return NextResponse.json({ data: await listOperationsGymOptions() });
});
