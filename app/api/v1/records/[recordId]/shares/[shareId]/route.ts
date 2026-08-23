import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { parseInput } from '../../../../../../../src/server/records/record-validation';
import { revokeRecordShare } from '../../../../../../../src/server/shares/share-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ShareRouteContext { params: Promise<{ recordId: string; shareId: string }> }

export const DELETE = withApiHandler<ShareRouteContext>(async (request, context) => {
  const { userId } = await requireUser(request);
  const { recordId, shareId } = await context.params;
  await revokeRecordShare(userId, parseInput(z.string().uuid(), recordId), parseInput(z.string().uuid(), shareId));
  return new NextResponse(null, { status: 204 });
});
