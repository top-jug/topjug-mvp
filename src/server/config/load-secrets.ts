import 'server-only';

import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

const PARAMETER_ENV_MAP = {
  'database-url': 'DATABASE_URL',
  'jwt-access-secret': 'JWT_ACCESS_SECRET',
  'jwt-refresh-secret': 'JWT_REFRESH_SECRET',
  'auth-rate-limit-pepper': 'AUTH_RATE_LIMIT_PEPPER',
} as const;

let loadPromise: Promise<void> | undefined;

function normalizePrefix(prefix: string) {
  return `/${prefix.split('/').filter(Boolean).join('/')}`;
}

async function load() {
  const profile = process.env.APP_PROFILE;
  const configuredPrefix = process.env.SSM_PARAMETER_PREFIX;
  if (profile === 'production' && !configuredPrefix) {
    throw new Error('SSM_PARAMETER_PREFIX is required for the production profile');
  }
  if (!configuredPrefix) return;

  const prefix = normalizePrefix(configuredPrefix);
  const parameterNames = Object.keys(PARAMETER_ENV_MAP).map((name) => `${prefix}/${name}`);
  const client = new SSMClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
  const response = await client.send(new GetParametersCommand({
    Names: parameterNames,
    WithDecryption: true,
  }));

  if (response.InvalidParameters?.length) {
    throw new Error(`Required SSM parameters are missing: ${response.InvalidParameters.join(', ')}`);
  }

  const values = new Map(response.Parameters?.map((parameter) => [parameter.Name, parameter.Value]) ?? []);
  for (const [parameterName, environmentName] of Object.entries(PARAMETER_ENV_MAP)) {
    const fullName = `${prefix}/${parameterName}`;
    const value = values.get(fullName);
    if (!value) throw new Error(`Required SSM parameter is empty: ${fullName}`);
    process.env[environmentName] = value;
  }

  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'config.ssm_loaded',
    parameterPrefix: prefix,
    parameterCount: parameterNames.length,
  }));
}

export function loadSecretsFromSsm() {
  loadPromise ??= load();
  return loadPromise;
}
