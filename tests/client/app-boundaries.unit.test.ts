import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('public and operations clients have separate Next.js entrypoints', () => {
  const publicRouter = source('src/app/router.tsx');
  const operationsRouter = source('apps/admin/src/features/operations/OperationsRouter.tsx');
  const publicSpa = source('apps/web/app/spa.tsx');
  const operationsSpa = source('apps/admin/app/spa.tsx');

  assert.doesNotMatch(publicRouter, /features\/operations|path="\/ops"/);
  assert.match(operationsRouter, /RequireOperationsAdmin/);
  assert.match(operationsRouter, /path="\/ops"/);
  assert.match(publicSpa, /src\/app\/App/);
  assert.match(operationsSpa, /src\/OperationsApp/);
});

test('the public host blocks operations APIs and the operations host proxies only its required API surface', () => {
  const caddy = source('ops/ec2/Caddyfile');

  assert.match(caddy, /topjug\.kr \{[\s\S]*@operationsApi[\s\S]*respond @operationsApi 404/);
  assert.match(caddy, /ops\.topjug\.kr \{[\s\S]*@adminApi[\s\S]*reverse_proxy 127\.0\.0\.1:3000/);
  assert.match(caddy, /handle \/api\/\*[\s\S]*respond 404/);
  assert.match(caddy, /reverse_proxy 127\.0\.0\.1:3001/);
});

test('the release runs public and operations apps as separate local-only services', () => {
  const publicService = source('ops/ec2/topjug-web.service');
  const operationsService = source('ops/ec2/topjug-admin.service');
  const deployment = source('.github/workflows/deploy.yml');
  const deployScript = source('ops/ec2/deploy.sh');

  assert.match(publicService, /WorkingDirectory=\/opt\/topjug\/current\/apps\/web/);
  assert.match(publicService, /Environment=HOSTNAME=127\.0\.0\.1[\s\S]*Environment=PORT=3000/);
  assert.match(operationsService, /WorkingDirectory=\/opt\/topjug\/current\/apps\/admin/);
  assert.match(operationsService, /Environment=HOSTNAME=127\.0\.0\.1[\s\S]*Environment=PORT=3001/);
  assert.match(deployment, /apps\/web\/\.next\/standalone/);
  assert.match(deployment, /apps\/admin\/\.next\/standalone/);
  assert.match(deployScript, /already deployed and healthy/);
  assert.match(deployScript, /release_is_healthy/);
});
