import { NextResponse } from 'next/server';
import { requireUser } from '../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../src/server/http/with-api-handler';
import { createMembership, listMemberships } from '../../../../src/server/memberships/membership-service';
import { membershipInputSchema } from '../../../../src/server/memberships/membership-validation';
import { parseInput, readJson } from '../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  const { userId } = await requireUser(request);
  return NextResponse.json(await listMemberships(userId));
});

export const POST = withApiHandler(async (request) => {
  const { userId } = await requireUser(request);
  const input = parseInput(membershipInputSchema, await readJson(request));
  return NextResponse.json({ data: await createMembership(userId, input) }, { status: 201 });
});
