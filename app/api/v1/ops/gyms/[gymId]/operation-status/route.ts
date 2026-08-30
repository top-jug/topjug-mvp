import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { updateOperationsGymStatus } from '../../../../../../../src/server/operations/operations-gym-service';
import { updateOperationsGymStatusSchema } from '../../../../../../../src/server/operations/operations-gym-validation';
import { parseInput, readJson } from '../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymRouteContext { params: Promise<{ gymId: string }> }

export const PATCH = withApiHandler<GymRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  const input = parseInput(updateOperationsGymStatusSchema, await readJson(request));
  return NextResponse.json({ data: await updateOperationsGymStatus(parseInput(z.string().uuid(), gymId), input) });
});
