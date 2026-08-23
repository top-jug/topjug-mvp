import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
import postgres from 'postgres';

async function databaseUrl() {
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

async function main() {
  const client = postgres(await databaseUrl(), { max: 1 });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: resolve(process.env.MIGRATIONS_FOLDER ?? 'drizzle'),
    });
    console.info(JSON.stringify({ event: 'database.migration_completed' }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
