import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../../src/server/http/with-api-handler';
import {
  createOperationsGymSettingSector,
  getOperationsGymSettingSectors,
} from '../../../../../../../../../src/server/operations/operations-gym-setting-sector-service';
import { createOperationsGymSettingSectorSchema } from '../../../../../../../../../src/server/operations/operations-gym-setting-sector-validation';
import { parseInput, readJson } from '../../../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymSettingSectorsRouteContext { params: Promise<{ gymId: string }> }

export const GET = withApiHandler<GymSettingSectorsRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  return NextResponse.json({ data: await getOperationsGymSettingSectors(parseInput(z.string().uuid(), gymId)) });
});

export const POST = withApiHandler<GymSettingSectorsRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  const input = parseInput(createOperationsGymSettingSectorSchema, await readJson(request));
  return NextResponse.json({
    data: await createOperationsGymSettingSector(parseInput(z.string().uuid(), gymId), input),
  }, { status: 201 });
});
