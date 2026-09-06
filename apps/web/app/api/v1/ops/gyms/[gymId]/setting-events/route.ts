import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../../src/server/http/with-api-handler';
import {
  createOperationsSettingEvent,
  listOperationsSettingEvents,
} from '../../../../../../../../../src/server/operations/operations-setting-event-service';
import {
  createOperationsGymSettingEventSchema,
  listOperationsGymSettingEventsSchema,
} from '../../../../../../../../../src/server/operations/operations-setting-event-validation';
import { parseInput, readJson } from '../../../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymSettingEventsRouteContext { params: Promise<{ gymId: string }> }

export const GET = withApiHandler<GymSettingEventsRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  const parsedGymId = parseInput(z.string().uuid(), gymId);
  const input = parseInput(
    listOperationsGymSettingEventsSchema,
    Object.fromEntries(request.nextUrl.searchParams),
  );
  return NextResponse.json({ data: await listOperationsSettingEvents({ ...input, gymId: parsedGymId }) });
});

export const POST = withApiHandler<GymSettingEventsRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  const parsedGymId = parseInput(z.string().uuid(), gymId);
  const input = parseInput(createOperationsGymSettingEventSchema, await readJson(request));
  return NextResponse.json({
    data: await createOperationsSettingEvent({ ...input, gymId: parsedGymId }),
  }, { status: 201 });
});
