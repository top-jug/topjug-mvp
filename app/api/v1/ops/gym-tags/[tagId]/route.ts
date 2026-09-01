import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOperationsAdmin } from '../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../src/server/http/with-api-handler';
import { deleteOperationsGymTag, updateOperationsGymTag } from '../../../../../../src/server/operations/operations-gym-tag-service';
import { deleteOperationsGymTagSchema, updateOperationsGymTagSchema } from '../../../../../../src/server/operations/operations-gym-tag-validation';
import { parseInput, readJson } from '../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GymTagRouteContext { params: Promise<{ tagId: string }> }

export const PATCH = withApiHandler<GymTagRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { tagId } = await context.params;
  const input = parseInput(updateOperationsGymTagSchema, await readJson(request));
  return NextResponse.json({ data: await updateOperationsGymTag(parseInput(z.string().uuid(), tagId), input) });
});

export const DELETE = withApiHandler<GymTagRouteContext>(async (request, context) => {
  await requireOperationsAdmin(request);
  const { tagId } = await context.params;
  const input = parseInput(deleteOperationsGymTagSchema, await readJson(request));
  await deleteOperationsGymTag(parseInput(z.string().uuid(), tagId), input);
  return new NextResponse(null, { status: 204 });
});
