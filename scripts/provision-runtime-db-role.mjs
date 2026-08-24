import { databaseUrl } from './database-url.mjs';
import postgres from 'postgres';

const RUNTIME_ROLE = 'topjug_app';

function quotedIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quotedLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function main() {
  if (process.env.APP_PROFILE !== 'production' || !process.argv.includes('--apply')) {
    throw new Error('Runtime database role provisioning requires APP_PROFILE=production and --apply');
  }

  const migrationUrl = new URL(await databaseUrl('migration-database-url'));
  const runtimeUrl = new URL(await databaseUrl('runtime-database-url'));
  const runtimePassword = decodeURIComponent(runtimeUrl.password);
  if (runtimeUrl.username !== RUNTIME_ROLE || runtimePassword.length < 32) {
    throw new Error(`Runtime database URL must use ${RUNTIME_ROLE} with a password of at least 32 characters`);
  }
  if (runtimeUrl.hostname !== migrationUrl.hostname || runtimeUrl.pathname !== migrationUrl.pathname) {
    throw new Error('Migration and runtime database URLs must target the same database');
  }

  const databaseName = decodeURIComponent(migrationUrl.pathname.slice(1));
  if (!databaseName) throw new Error('Migration database URL must include a database name');
  const client = postgres(migrationUrl.toString(), { max: 1, connect_timeout: 10 });
  try {
    const [existing] = await client`
      select oid, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
      from pg_roles where rolname = ${RUNTIME_ROLE}
    `;
    const role = quotedIdentifier(RUNTIME_ROLE);
    if (existing && (existing.rolsuper || existing.rolcreatedb || existing.rolcreaterole || existing.rolreplication || existing.rolbypassrls)) {
      throw new Error('Existing runtime database role has elevated role attributes');
    }
    if (existing) {
      const [{ memberships, owned_objects: ownedObjects }] = await client`
        select
          (select count(*)::int from pg_auth_members where member = ${existing.oid}) as memberships,
          (
            select count(*)::int from pg_shdepend
            where refclassid = 'pg_authid'::regclass
              and refobjid = ${existing.oid}
              and deptype = 'o'
          ) as owned_objects
      `;
      if (memberships > 0 || ownedObjects > 0) {
        throw new Error('Existing runtime database role has role memberships or owns database objects');
      }
    }
    const password = quotedLiteral(runtimePassword);
    await client.unsafe(
      existing
        ? `alter role ${role} login password ${password} noinherit`
        : `create role ${role} login password ${password} nosuperuser nocreatedb nocreaterole noinherit`,
    );
    await client.unsafe(`revoke all privileges on database ${quotedIdentifier(databaseName)} from ${role}`);
    await client.unsafe(`grant connect on database ${quotedIdentifier(databaseName)} to ${role}`);
    await client.unsafe('revoke create on schema public from public');
    await client.unsafe(`revoke all privileges on schema public from ${role}`);
    await client.unsafe(`grant usage on schema public to ${role}`);
    await client.unsafe(`revoke all privileges on all tables in schema public from ${role}`);
    await client.unsafe(`grant select, insert, update, delete on all tables in schema public to ${role}`);
    await client.unsafe(`revoke all privileges on all sequences in schema public from ${role}`);
    await client.unsafe(`grant usage on all sequences in schema public to ${role}`);
    await client.unsafe(`alter default privileges in schema public revoke all privileges on tables from ${role}`);
    await client.unsafe(`alter default privileges in schema public grant select, insert, update, delete on tables to ${role}`);
    await client.unsafe(`alter default privileges in schema public revoke all privileges on sequences from ${role}`);
    await client.unsafe(`alter default privileges in schema public grant usage on sequences to ${role}`);

    const runtimeClient = postgres(runtimeUrl.toString(), { max: 1, connect_timeout: 10 });
    try {
      const [identity] = await runtimeClient`select current_user as current_user`;
      if (identity.current_user !== RUNTIME_ROLE) throw new Error('Runtime database role identity check failed');
      if (process.argv.includes('--verify-schema')) {
        await runtimeClient`select 1 from gyms limit 1`;
      }
      try {
        await runtimeClient.unsafe('create table public.topjug_runtime_role_probe (id integer)');
        await runtimeClient.unsafe('drop table public.topjug_runtime_role_probe');
        throw new Error('Runtime database role unexpectedly has schema creation permission');
      } catch (error) {
        if (error instanceof Error && error.message.includes('unexpectedly')) throw error;
        if (error?.code !== '42501') throw error;
      }
    } finally {
      await runtimeClient.end();
    }
    console.info(JSON.stringify({ event: 'database.runtime_role_provisioned', role: RUNTIME_ROLE }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
