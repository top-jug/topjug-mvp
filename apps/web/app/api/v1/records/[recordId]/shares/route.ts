import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../src/server/http/with-api-handler';
import { parseInput, readJson } from '../../../../../../../../src/server/records/record-validation';
import { createRecordShare, listRecordShares } from '../../../../../../../../src/server/shares/share-service';
import { createShareSchema } from '../../../../../../../../src/server/shares/share-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ShareRouteContext { params: Promise<{ recordId: string }> }

export const GET = withApiHandler<ShareRouteContext>(async (request, context) => {
  const { userId } = await requireUser(request);
  const { recordId } = await context.params;
  return NextResponse.json(await listRecordShares(userId, parseInput(z.string().uuid(), recordId)));
});

export const POST = withApiHandler<ShareRouteContext>(async (request, context) => {
  const { userId } = await requireUser(request);
  const { recordId } = await context.params;
  const input = parseInput(createShareSchema, await readJson(request));
  return NextResponse.json({ data: await createRecordShare(userId, parseInput(z.string().uuid(), recordId), input) }, { status: 201 });
});
