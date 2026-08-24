import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { databaseUrl } from './database-url.mjs';

async function main() {
  const client = postgres(await databaseUrl('migration-database-url'), { max: 1 });
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
