import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../../src/server/http/with-api-handler';
import { readOperationsGymPhotoUpload } from '../../../../../../../../../src/server/media/media-upload-request';
import { assertOperationsGymPhotoUploadAllowed, attachOperationsGymPhoto, getOperationsGymPhotos } from '../../../../../../../../../src/server/operations/operations-gym-media-service';
import { operationsGymPhotoMutationSchema } from '../../../../../../../../../src/server/operations/operations-gym-media-validation';
import { uploadOperationsImage } from '../../../../../../../../../src/server/operations/operations-media-service';
import { parseInput } from '../../../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymMediaRouteContext { params: Promise<{ gymId: string }> }

export const GET = withApiHandler<GymMediaRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  return NextResponse.json({ data: await getOperationsGymPhotos(parseInput(z.string().uuid(), gymId)) });
});

export const POST = withApiHandler<GymMediaRouteContext>(async (request, context) => {
  const identity = await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  const parsedGymId = parseInput(z.string().uuid(), gymId);
  const { expectedUpdatedAt, ...upload } = await readOperationsGymPhotoUpload(request);
  const input = parseInput(operationsGymPhotoMutationSchema, { expectedUpdatedAt });
  await assertOperationsGymPhotoUploadAllowed(parsedGymId, input.expectedUpdatedAt);
  const asset = await uploadOperationsImage({ ownerUserId: identity.userId, ...upload });
  return NextResponse.json({
    data: await attachOperationsGymPhoto(
      parsedGymId,
      asset.id,
      identity.userId,
      input,
    ),
  }, { status: 201 });
});
