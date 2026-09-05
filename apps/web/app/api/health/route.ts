import { NextResponse } from 'next/server';
import { withApiHandler } from '../../../../../src/server/http/with-api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(() =>
  NextResponse.json({
    status: 'ok',
    service: 'topjug-mvp',
    timestamp: new Date().toISOString(),
  }),
);
