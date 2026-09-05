import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../../../../src/server/http/with-api-handler';
import { batchOperatingHourOverrides } from '../../../../../../../../../../src/server/operations/operations-gym-hours-service';
import { batchOperatingHourOverridesSchema, parseOperatingHoursInput } from '../../../../../../../../../../src/server/operations/operations-gym-validation';
import { parseInput, readJson } from '../../../../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface BatchRouteContext { params: Promise<{ gymId: string }> }

export const POST = withApiHandler<BatchRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  const input = parseOperatingHoursInput(batchOperatingHourOverridesSchema, await readJson(request));
  return NextResponse.json({ data: await batchOperatingHourOverrides(parseInput(z.string().uuid(), gymId), input) });
});
