import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../src/server/http/with-api-handler';
import { cancelRecordSession } from '../../../../../../../../src/server/records/record-session-service';
import { parseInput, readJson, recordTransitionSchema } from '../../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
interface Context { params: Promise<{ recordId: string }> }

export const POST = withApiHandler<Context>(async (request, context) => {
  const { userId } = await requireUser(request);
  const { recordId } = await context.params;
  const input = parseInput(recordTransitionSchema, await readJson(request));
  return NextResponse.json({ data: await cancelRecordSession(userId, parseInput(z.string().uuid(), recordId), input.at ? new Date(input.at) : undefined) });
});
