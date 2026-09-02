import { NextResponse } from 'next/server';
import { confirmEmailVerificationSchema } from '../../../../../../src/server/auth/auth-validation';
import { confirmEmailVerification } from '../../../../../../src/server/auth/email-verification-service';
import { getClientAddress } from '../../../../../../src/server/http/client-address';
import { withApiHandler } from '../../../../../../src/server/http/with-api-handler';
import { parseInput, readJson } from '../../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApiHandler(async (request) => {
  const input = parseInput(confirmEmailVerificationSchema, await readJson(request));
  const result = await confirmEmailVerification(input, getClientAddress(request));
  return NextResponse.json({ data: result });
});
