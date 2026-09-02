import { NextResponse } from 'next/server';
import { requireOperationsAdmin } from '../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../src/server/http/with-api-handler';
import {
  createOperationsSettingEvent,
  listOperationsSettingEvents,
} from '../../../../../src/server/operations/operations-setting-event-service';
import {
  createOperationsSettingEventSchema,
  listOperationsSettingEventsSchema,
} from '../../../../../src/server/operations/operations-setting-event-validation';
import { parseInput, readJson } from '../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  await requireOperationsAdmin(request);
  const input = parseInput(listOperationsSettingEventsSchema, Object.fromEntries(request.nextUrl.searchParams));
  return NextResponse.json({ data: await listOperationsSettingEvents(input) });
});

export const POST = withApiHandler(async (request) => {
  await requireOperationsAdmin(request);
  const input = parseInput(createOperationsSettingEventSchema, await readJson(request));
  return NextResponse.json({ data: await createOperationsSettingEvent(input) }, { status: 201 });
});
