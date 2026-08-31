import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../src/server/http/with-api-handler';
import {
  deleteOperatingHourOverride,
  replaceOperatingHourOverride,
} from '../../../../../../../../src/server/operations/operations-gym-hours-service';
import {
  deleteOperatingHourOverrideSchema,
  operatingDateSchema,
  parseOperatingHoursInput,
  replaceOperatingHourOverrideSchema,
} from '../../../../../../../../src/server/operations/operations-gym-validation';
import { parseInput, readJson } from '../../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface OverrideRouteContext { params: Promise<{ gymId: string; date: string }> }

export const PUT = withApiHandler<OverrideRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId, date } = await context.params;
  const input = parseOperatingHoursInput(replaceOperatingHourOverrideSchema, await readJson(request));
  return NextResponse.json({
    data: await replaceOperatingHourOverride(
      parseInput(z.string().uuid(), gymId),
      parseOperatingHoursInput(operatingDateSchema, date),
      input,
    ),
  });
});

export const DELETE = withApiHandler<OverrideRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId, date } = await context.params;
  const input = parseOperatingHoursInput(deleteOperatingHourOverrideSchema, await readJson(request));
  return NextResponse.json({
    data: await deleteOperatingHourOverride(
      parseInput(z.string().uuid(), gymId),
      parseOperatingHoursInput(operatingDateSchema, date),
      input,
    ),
  });
});
