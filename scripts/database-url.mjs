import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

export async function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const prefix = process.env.SSM_PARAMETER_PREFIX;
  if (!prefix) throw new Error('DATABASE_URL or SSM_PARAMETER_PREFIX is required');

  const name = `${prefix.replace(/\/$/, '')}/database-url`;
  const client = new SSMClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
  try {
    const response = await client.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    if (!response.Parameter?.Value) throw new Error(`Required SSM parameter is empty: ${name}`);
    return response.Parameter.Value;
  } finally {
    client.destroy();
  }
}
