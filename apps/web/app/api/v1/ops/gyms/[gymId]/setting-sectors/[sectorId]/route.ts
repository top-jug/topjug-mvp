import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../../../src/server/http/with-api-handler';
import {
  deleteOperationsGymSettingSector,
  updateOperationsGymSettingSector,
} from '../../../../../../../../../../src/server/operations/operations-gym-setting-sector-service';
import {
  deleteOperationsGymSettingSectorSchema,
  updateOperationsGymSettingSectorSchema,
} from '../../../../../../../../../../src/server/operations/operations-gym-setting-sector-validation';
import { parseInput, readJson } from '../../../../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymSettingSectorRouteContext { params: Promise<{ gymId: string; sectorId: string }> }

export const PATCH = withApiHandler<GymSettingSectorRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId, sectorId } = await context.params;
  const input = parseInput(updateOperationsGymSettingSectorSchema, await readJson(request));
  return NextResponse.json({
    data: await updateOperationsGymSettingSector(
      parseInput(z.string().uuid(), gymId),
      parseInput(z.string().uuid(), sectorId),
      input,
    ),
  });
});

export const DELETE = withApiHandler<GymSettingSectorRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId, sectorId } = await context.params;
  const input = parseInput(deleteOperationsGymSettingSectorSchema, await readJson(request));
  return NextResponse.json({
    data: await deleteOperationsGymSettingSector(
      parseInput(z.string().uuid(), gymId),
      parseInput(z.string().uuid(), sectorId),
      input,
    ),
  });
});
