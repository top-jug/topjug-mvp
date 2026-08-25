import { NextResponse } from 'next/server';
import { findAccount } from '../../../../../src/server/auth/auth-service';
import { findAccountSchema } from '../../../../../src/server/auth/auth-validation';
import { withApiHandler } from '../../../../../src/server/http/with-api-handler';
import { parseInput, readJson } from '../../../../../src/server/records/record-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApiHandler(async (request) => {
  const input = parseInput(findAccountSchema, await readJson(request));
  const result = await findAccount(input);
  return NextResponse.json({ data: result });
});
