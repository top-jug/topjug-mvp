import postgres from 'postgres';
import { databaseUrl } from './database-url.mjs';

async function deleteBatch(client, table, timestampColumn, retention) {
  return client.unsafe(`
    with expired as (
      select id from ${table}
      where ${timestampColumn} < now() - interval '${retention}'
      order by ${timestampColumn}
      limit 10000
    )
    delete from ${table}
    where id in (select id from expired)
  `);
}

async function main() {
  const client = postgres(await databaseUrl(), { max: 1 });
  try {
    const attempts = await deleteBatch(client, 'login_attempts', 'attempted_at', '1 day');
    const emailVerifications = await deleteBatch(client, 'email_verification_challenges', 'expires_at', '1 day');
    const sessions = await client.unsafe(`
      with expired as (
        select id from refresh_sessions
        where expires_at < now() - interval '30 days'
           or revoked_at < now() - interval '30 days'
        order by expires_at
        limit 10000
      )
      delete from refresh_sessions
      where id in (select id from expired)
    `);
    const audits = await deleteBatch(client, 'audit_events', 'occurred_at', '365 days');
    console.info(JSON.stringify({
      event: 'security_data.cleanup_completed',
      deleted: { attempts: attempts.count, emailVerifications: emailVerifications.count, sessions: sessions.count, audits: audits.count },
    }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
