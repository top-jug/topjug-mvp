import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production deployment gates and live-tests the configured SES identity', async () => {
  const [workflow, service, deploy, infrastructure, packageJson] = await Promise.all([
    readFile('.github/workflows/deploy.yml', 'utf8'),
    readFile('ops/ec2/topjug.service', 'utf8'),
    readFile('ops/ec2/deploy.sh', 'utf8'),
    readFile('ops/aws/production-data.yaml', 'utf8'),
    readFile('package.json', 'utf8'),
  ]);

  assert.match(service, /Environment=EMAIL_DELIVERY_MODE=ses/);
  assert.match(service, /Environment=EMAIL_FROM_ADDRESS=no-reply@topjug\.kr/);
  assert.match(workflow, /Gate deployment on production email readiness/);
  assert.match(workflow, /if: steps\.email_readiness\.outputs\.ready == 'true'/);
  assert.match(deploy, /verify-production-email\.cjs/);
  assert.match(deploy, /EMAIL_DELIVERY_MODE=ses/);
  assert.match(infrastructure, /Type: AWS::SES::EmailIdentity/);
  assert.match(infrastructure, /ses:SendEmail/);
  assert.match(infrastructure, /ses:GetEmailIdentity/);
  assert.match(packageJson, /scripts\/verify-production-email\.mjs/);
});

test('production deployment is gated by database integration and HTTP contract tests', async () => {
  const workflow = await readFile('.github/workflows/deploy.yml', 'utf8');
  const integrationTest = workflow.indexOf('npm test && npm run test:integration');
  const httpTest = workflow.indexOf('npm run test:http');
  const productionAccess = workflow.indexOf('Configure AWS credentials');

  assert.match(workflow, /image: postgres:16-alpine/);
  assert.match(workflow, /EMAIL_DELIVERY_MODE: file/);
  assert.ok(integrationTest >= 0 && integrationTest < productionAccess);
  assert.ok(httpTest >= 0 && httpTest < productionAccess);
});
