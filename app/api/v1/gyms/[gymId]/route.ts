import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGym } from '../../../../../src/server/gyms/gym-service';
import { withApiHandler } from '../../../../../src/server/http/with-api-handler';
import { parseInput } from '../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymRouteContext {
  params: Promise<{ gymId: string }>;
}

export const GET = withApiHandler<GymRouteContext>(async (_request, context) => {
  const { gymId } = await context.params;
  return NextResponse.json({ data: await getGym(parseInput(z.string().uuid(), gymId)) });
});
