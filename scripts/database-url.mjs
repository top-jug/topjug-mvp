import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

export async function databaseUrl(parameterName = 'runtime-database-url') {
  const parameterEnvironmentName = parameterName === 'migration-database-url'
    ? 'MIGRATION_DATABASE_URL'
    : parameterName === 'runtime-database-url'
      ? 'RUNTIME_DATABASE_URL'
      : undefined;
  let value = (parameterEnvironmentName && process.env[parameterEnvironmentName]) || process.env.DATABASE_URL;
  if (!value) {
    const prefix = process.env.SSM_PARAMETER_PREFIX;
    if (!prefix) throw new Error('DATABASE_URL or SSM_PARAMETER_PREFIX is required');

    const normalizedPrefix = `/${prefix.split('/').filter(Boolean).join('/')}`;
    const name = `${normalizedPrefix}/${parameterName}`;
    const client = new SSMClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    try {
      const response = await client.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
      if (!response.Parameter?.Value) throw new Error(`Required SSM parameter is empty: ${name}`);
      value = response.Parameter.Value;
    } finally {
      client.destroy();
    }
  }
  if (process.env.APP_PROFILE === 'production') {
    const parsed = new URL(value);
    if (parsed.protocol !== 'postgresql:' || !['require', 'verify-full'].includes(parsed.searchParams.get('sslmode'))) {
      throw new Error('Production DATABASE_URL must use PostgreSQL with sslmode=require or verify-full');
    }
  }
  return value;
}
