import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { getRecord } from '../../../../../../../src/server/records/record-service';
import { parseInput } from '../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RecordRouteContext {
  params: Promise<{ recordId: string }>;
}

export const GET = withApiHandler<RecordRouteContext>(async (request, context) => {
  const { userId } = await requireUser(request);
  const { recordId } = await context.params;
  const validRecordId = parseInput(z.string().uuid(), recordId);
  return NextResponse.json({ data: await getRecord(userId, validRecordId) });
});
