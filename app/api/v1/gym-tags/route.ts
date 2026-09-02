import { NextResponse } from 'next/server';
import { listActiveGymTags } from '../../../../src/server/gyms/gym-tag-service';
import { withApiHandler } from '../../../../src/server/http/with-api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async () => NextResponse.json({ data: await listActiveGymTags() }));
