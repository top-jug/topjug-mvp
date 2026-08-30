import { NextResponse } from 'next/server';
import { listRegions } from '../../../../src/server/regions/region-service';
import { withApiHandler } from '../../../../src/server/http/with-api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async () => NextResponse.json(await listRegions()));
