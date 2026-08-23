import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { ApiError } from '../http/api-error';

let client: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDatabase() {
  if (database) return database;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', '데이터베이스가 아직 연결되지 않았습니다.');
  }

  client = postgres(databaseUrl, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  database = drizzle(client, { schema });
  return database;
}

export async function closeDatabase() {
  await client?.end();
  client = undefined;
  database = undefined;
}
