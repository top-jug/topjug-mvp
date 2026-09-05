import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../src/server/http/with-api-handler';
import {
  deleteOperationsSettingEvent,
  getOperationsSettingEvent,
  updateOperationsSettingEvent,
} from '../../../../../../../../src/server/operations/operations-setting-event-service';
import {
  deleteOperationsSettingEventSchema,
  updateOperationsSettingEventSchema,
} from '../../../../../../../../src/server/operations/operations-setting-event-validation';
import { parseInput, readJson } from '../../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SettingEventRouteContext { params: Promise<{ eventId: string }> }

export const GET = withApiHandler<SettingEventRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { eventId } = await context.params;
  return NextResponse.json({ data: await getOperationsSettingEvent(parseInput(z.string().uuid(), eventId)) });
});

export const PATCH = withApiHandler<SettingEventRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { eventId } = await context.params;
  const input = parseInput(updateOperationsSettingEventSchema, await readJson(request));
  return NextResponse.json({ data: await updateOperationsSettingEvent(parseInput(z.string().uuid(), eventId), input) });
});

export const DELETE = withApiHandler<SettingEventRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { eventId } = await context.params;
  const input = parseInput(deleteOperationsSettingEventSchema, await readJson(request));
  await deleteOperationsSettingEvent(parseInput(z.string().uuid(), eventId), input);
  return new NextResponse(null, { status: 204 });
});
