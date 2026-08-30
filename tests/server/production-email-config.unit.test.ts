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
