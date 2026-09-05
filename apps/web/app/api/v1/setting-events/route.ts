import { NextResponse } from 'next/server';
import { listSettingEvents } from '../../../../../../src/server/calendar/setting-event-service';
import { listSettingEventsSchema } from '../../../../../../src/server/calendar/setting-event-validation';
import { withApiHandler } from '../../../../../../src/server/http/with-api-handler';
import { parseInput } from '../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  return NextResponse.json(await listSettingEvents(parseInput(listSettingEventsSchema, query)));
});
