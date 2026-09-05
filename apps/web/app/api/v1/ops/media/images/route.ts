import { NextResponse } from 'next/server';
import { requireOperationsAdmin } from '../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../src/server/http/with-api-handler';
import { readImageUpload } from '../../../../../../../../src/server/media/media-upload-request';
import { uploadOperationsImage } from '../../../../../../../../src/server/operations/operations-media-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApiHandler(async (request) => {
  const identity = await requireOperationsAdmin(request);
  const upload = await readImageUpload(request);
  return NextResponse.json({
    data: await uploadOperationsImage({ ownerUserId: identity.userId, ...upload }),
  }, { status: 201 });
});
