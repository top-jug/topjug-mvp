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

test('record runtime never reads or writes the retained session type column', () => {
  const recordService = source('src/server/records/record-service.ts');
  const sessionService = source('src/server/records/record-session-service.ts');
  const runtimeContract = [
    'docs/backend/openapi.yaml',
    'src/app/api/record-api.ts',
    'src/server/records/record-service.ts',
    'src/server/records/record-session-service.ts',
    'src/server/records/record-validation.ts',
    'src/server/shares/share-service.ts',
  ].map(source).join('\n');
  const createInsert = recordService.slice(
    recordService.indexOf('.insert(climbingRecords)'),
    recordService.indexOf('const counts ='),
  );
  const sessionInsert = sessionService.slice(
    sessionService.indexOf('transaction.insert(climbingRecords)'),
    sessionService.indexOf("transaction.insert(auditEvents)"),
  );

  assert.doesNotMatch(runtimeContract, /sessionType|session_type|record_session_type/);
  assert.match(createInsert, /\.returning\(\{/);
  assert.doesNotMatch(createInsert, /\.returning\(\)/);
  assert.doesNotMatch(sessionService, /select\(\)\.from\(climbingRecords\)/);
  assert.match(sessionInsert, /\.returning\(\{/);
  assert.doesNotMatch(sessionInsert, /\.returning\(\)/);
});

test('session type remains declared for the phase-two physical migration', () => {
  const schema = source('src/server/db/schema.ts');
  const erd = source('docs/backend/erd.md');
  const journal = source('drizzle/meta/_journal.json');

  assert.match(schema, /recordSessionType = pgEnum\('record_session_type'/);
  assert.match(schema, /sessionType: recordSessionType\('session_type'\)/);
  assert.match(erd, /record_session_type session_type/);
  assert.doesNotMatch(journal, /drop_record_session_type/);
});
