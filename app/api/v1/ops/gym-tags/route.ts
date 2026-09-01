import { NextResponse } from 'next/server';
import { requireOperationsAdmin } from '../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../src/server/http/with-api-handler';
import { createOperationsGymTag, listOperationsGymTags } from '../../../../../src/server/operations/operations-gym-tag-service';
import { createOperationsGymTagSchema } from '../../../../../src/server/operations/operations-gym-tag-validation';
import { parseInput, readJson } from '../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  await requireOperationsAdmin(request);
  return NextResponse.json({ data: await listOperationsGymTags() });
});

export const POST = withApiHandler(async (request) => {
  await requireOperationsAdmin(request);
  const input = parseInput(createOperationsGymTagSchema, await readJson(request));
  return NextResponse.json({ data: await createOperationsGymTag(input) }, { status: 201 });
});
