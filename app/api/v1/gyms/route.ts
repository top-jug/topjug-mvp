import { NextResponse } from 'next/server';
import { listGyms } from '../../../../src/server/gyms/gym-service';
import { listGymsSchema } from '../../../../src/server/gyms/gym-validation';
import { withApiHandler } from '../../../../src/server/http/with-api-handler';
import { parseInput } from '../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async (request) => {
  const query: Record<string, string | string[]> = Object.fromEntries(request.nextUrl.searchParams.entries());
  const facilities = request.nextUrl.searchParams.getAll('facility');
  if (facilities.length > 0) query.facility = facilities;
  return NextResponse.json(await listGyms(parseInput(listGymsSchema, query)));
});
