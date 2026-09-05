import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../src/server/http/with-api-handler';
import { createRecord, listRecords } from '../../../../../../src/server/records/record-service';
import { createRecordSchema, listRecordsSchema, parseInput, readJson } from '../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  const { userId } = await requireUser(request);
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const input = parseInput(listRecordsSchema, query);
  return NextResponse.json(await listRecords(userId, input));
});

export const POST = withApiHandler(async (request) => {
  const { userId } = await requireUser(request);
  const input = parseInput(createRecordSchema, await readJson(request));
  const record = await createRecord(userId, input);
  return NextResponse.json({ data: record }, { status: 201 });
});
