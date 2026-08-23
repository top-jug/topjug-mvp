import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../../../../src/server/auth/request-auth';
import { saveGym, unsaveGym } from '../../../../../../src/server/gyms/saved-gym-service';
import { withApiHandler } from '../../../../../../src/server/http/with-api-handler';
import { parseInput } from '../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SavedGymRouteContext {
  params: Promise<{ gymId: string }>;
}

export const PUT = withApiHandler<SavedGymRouteContext>(async (request, context) => {
  const { userId } = await requireUser(request);
  const { gymId } = await context.params;
  await saveGym(userId, parseInput(z.string().uuid(), gymId));
  return new NextResponse(null, { status: 204 });
});

export const DELETE = withApiHandler<SavedGymRouteContext>(async (request, context) => {
  const { userId } = await requireUser(request);
  const { gymId } = await context.params;
  await unsaveGym(userId, parseInput(z.string().uuid(), gymId));
  return new NextResponse(null, { status: 204 });
});
