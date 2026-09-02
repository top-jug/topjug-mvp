import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { getOperationsGymTagAssignments, replaceOperationsGymTags } from '../../../../../../../src/server/operations/operations-gym-tag-service';
import { replaceOperationsGymTagsSchema } from '../../../../../../../src/server/operations/operations-gym-tag-validation';
import { parseInput, readJson } from '../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymTagsRouteContext { params: Promise<{ gymId: string }> }

export const GET = withApiHandler<GymTagsRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  return NextResponse.json({ data: await getOperationsGymTagAssignments(parseInput(z.string().uuid(), gymId)) });
});

export const PUT = withApiHandler<GymTagsRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { gymId } = await context.params;
  const input = parseInput(replaceOperationsGymTagsSchema, await readJson(request));
  return NextResponse.json({ data: await replaceOperationsGymTags(parseInput(z.string().uuid(), gymId), input) });
});
