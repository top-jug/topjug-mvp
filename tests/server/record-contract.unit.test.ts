import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('record API contract exposes gym logos and the server resolves ready logo media', () => {
  const openApi = source('docs/backend/openapi.yaml');
  const service = source('src/server/records/record-service.ts');

  assert.match(openApi, /GymReference:[\s\S]*required: \[id, name, branchName, logo\]/);
  assert.match(openApi, /logo:[\s\S]*\$ref: '#\/components\/schemas\/MediaReference'/);
  assert.match(service, /eq\(gymMedia\.type, 'logo'\)/);
  assert.match(service, /eq\(mediaAssets\.status, 'ready'\)/);
  assert.match(service, /attachGymLogos/);
});

test('session type is absent from record runtime and API contracts', () => {
  const runtimeContract = [
    'docs/backend/openapi.yaml',
    'src/app/api/record-api.ts',
    'src/server/db/schema.ts',
    'src/server/records/record-service.ts',
    'src/server/records/record-validation.ts',
    'src/server/shares/share-service.ts',
  ].map(source).join('\n');

  assert.doesNotMatch(runtimeContract, /sessionType|session_type|record_session_type/);
  const migration = source('drizzle/0005_drop_record_session_type.sql');
  assert.match(migration, /SET LOCAL lock_timeout = '5s'/);
  assert.match(migration, /DROP COLUMN "session_type"/);
  assert.match(migration, /DROP TYPE "public"\."record_session_type"/);
  assert.doesNotMatch(migration, /CASCADE/);
});
