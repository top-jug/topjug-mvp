import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { getActiveRecordSession, startRecordSession } from '../../../../../../../src/server/records/record-session-service';
import { parseInput, readJson, startRecordSessionSchema } from '../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  const { userId } = await requireUser(request);
  return NextResponse.json({ data: await getActiveRecordSession(userId) });
});

export const POST = withApiHandler(async (request) => {
  const { userId } = await requireUser(request);
  const input = parseInput(startRecordSessionSchema, await readJson(request));
  return NextResponse.json({ data: await startRecordSession(userId, input) }, { status: 201 });
});
