import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../src/server/http/with-api-handler';
import { getOperationsGym, updateOperationsGym } from '../../../../../../src/server/operations/operations-gym-service';
import { updateOperationsGymSchema } from '../../../../../../src/server/operations/operations-gym-validation';
import { parseInput, readJson } from '../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymRouteContext { params: Promise<{ gymId: string }> }

export const GET = withApiHandler<GymRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  return NextResponse.json({ data: await getOperationsGym(parseInput(z.string().uuid(), gymId)) });
});

export const PATCH = withApiHandler<GymRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  const input = parseInput(updateOperationsGymSchema, await readJson(request));
  return NextResponse.json({ data: await updateOperationsGym(parseInput(z.string().uuid(), gymId), input) });
});
