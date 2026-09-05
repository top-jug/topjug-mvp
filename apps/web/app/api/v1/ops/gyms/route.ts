import { NextResponse } from 'next/server';
import { requireOperationsAdmin } from '../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { parseInput, readJson } from '../../../../../../../src/server/records/record-validation';
import { createOperationsGym, listOperationsGyms } from '../../../../../../../src/server/operations/operations-gym-service';
import { createOperationsGymSchema, listOperationsGymsSchema } from '../../../../../../../src/server/operations/operations-gym-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  await requireOperationsAdmin(request);
  const input = parseInput(listOperationsGymsSchema, Object.fromEntries(request.nextUrl.searchParams));
  return NextResponse.json(await listOperationsGyms(input));
});

export const POST = withApiHandler(async (request) => {
  await requireOperationsAdmin(request);
  const input = parseInput(createOperationsGymSchema, await readJson(request));
  return NextResponse.json({ data: await createOperationsGym(input) }, { status: 201 });
});
