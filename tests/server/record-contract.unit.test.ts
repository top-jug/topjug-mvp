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

