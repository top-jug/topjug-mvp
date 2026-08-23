import { NextResponse } from 'next/server';
import { assertReady } from '../../../src/server/config/readiness';
import { withApiHandler } from '../../../src/server/http/with-api-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiHandler(async () => {
  await assertReady();
  return NextResponse.json({ status: 'ready', service: 'topjug-mvp' });
});
