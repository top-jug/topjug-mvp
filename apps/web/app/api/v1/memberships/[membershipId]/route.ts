import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../../../../../src/server/auth/request-auth';
import { withApiHandler } from '../../../../../../../src/server/http/with-api-handler';
import { archiveMembership, replaceMembership } from '../../../../../../../src/server/memberships/membership-service';
import { membershipUpdateInputSchema } from '../../../../../../../src/server/memberships/membership-validation';
import { parseInput, readJson } from '../../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface MembershipRouteContext {
  params: Promise<{ membershipId: string }>;
}

export const PUT = withApiHandler<MembershipRouteContext>(async (request, context) => {
  const { userId } = await requireUser(request);
  const { membershipId } = await context.params;
  const validId = parseInput(z.string().uuid(), membershipId);
  const input = parseInput(membershipUpdateInputSchema, await readJson(request));
  return NextResponse.json({ data: await replaceMembership(userId, validId, input) });
});

export const DELETE = withApiHandler<MembershipRouteContext>(async (request, context) => {
  const { userId } = await requireUser(request);
  const { membershipId } = await context.params;
  await archiveMembership(userId, parseInput(z.string().uuid(), membershipId));
  return new NextResponse(null, { status: 204 });
});
