import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../../../src/server/http/with-api-handler';
import { deleteOperationsGymPhoto } from '../../../../../../../../../../src/server/operations/operations-gym-media-service';
import { operationsGymPhotoMutationSchema } from '../../../../../../../../../../src/server/operations/operations-gym-media-validation';
import { parseInput, readJson } from '../../../../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymMediaItemRouteContext { params: Promise<{ gymId: string; gymMediaId: string }> }

export const DELETE = withApiHandler<GymMediaItemRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId, gymMediaId } = await context.params;
  const input = parseInput(operationsGymPhotoMutationSchema, await readJson(request));
  return NextResponse.json({
    data: await deleteOperationsGymPhoto(
      parseInput(z.string().uuid(), gymId),
      parseInput(z.string().uuid(), gymMediaId),
      input,
    ),
  });
});
