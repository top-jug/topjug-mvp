import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { verifyOperationsGym } from '../../../../../../../src/server/operations/operations-gym-service';
import { verifyOperationsGymSchema } from '../../../../../../../src/server/operations/operations-gym-validation';
import { parseInput, readJson } from '../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymRouteContext { params: Promise<{ gymId: string }> }

export const POST = withApiHandler<GymRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  const input = parseInput(verifyOperationsGymSchema, await readJson(request));
  return NextResponse.json({ data: await verifyOperationsGym(parseInput(z.string().uuid(), gymId), input) });
});
