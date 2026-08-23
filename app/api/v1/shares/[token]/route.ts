import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '../../../../../src/server/http/with-api-handler';
import { parseInput } from '../../../../../src/server/records/record-validation';
import { getRecordShare } from '../../../../../src/server/shares/share-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PublicShareRouteContext { params: Promise<{ token: string }> }

export const GET = withApiHandler<PublicShareRouteContext>(async (_request, context) => {
  const { token } = await context.params;
  return NextResponse.json({ data: await getRecordShare(parseInput(z.string().min(40).max(100), token)) });
});
