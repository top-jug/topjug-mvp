# Operations console runbook

The operations console is served at `/ops` outside the mobile preview layout. Both the client route and every operations API enforce the `operations_admin` role. The server reads the current role from PostgreSQL for each operations request, so demotion takes effect without waiting for an access token to expire.

## Local verification

1. Create `.env.local` from `.env.local.example` if it does not exist.
2. Start PostgreSQL and apply migrations.

   ```bash
   npm run local:up
   npm run db:migrate:local
   ```

3. Preview the initial administrator command. Preview mode validates the email and display name but does not connect to the database or request a password.

   ```bash
   npm run ops:admin:create:local -- \
     --email admin@example.com \
     --display-name "운영자"
   ```

4. Run it again with `--apply`. Enter the password twice in the hidden terminal prompt. The password must be 12–128 characters and cannot be supplied through an argument or environment variable.

   ```bash
   npm run ops:admin:create:local -- \
     --email admin@example.com \
     --display-name "운영자" \
     --apply
   ```

5. Start the application, sign in with that account, and open `http://localhost:3000/ops`.

   ```bash
   npm run dev:local
   ```

A repeated email is rejected and no second account or audit row is created. Successful creation records an `ops.admin.bootstrap` event without the email, display name, or password in audit metadata.

## Production bootstrap

Use an interactive SSM shell on the application host after the release containing this command and migration has been deployed. Run the packaged command from the current release directory:

```bash
APP_PROFILE=production SSM_PARAMETER_PREFIX=/topjug/prod \
  node .migration/create-operations-admin.cjs \
  --email admin@example.com \
  --display-name "운영자" \
  --apply
```

The command reads the existing `runtime-database-url` SecureString and requires an interactive TTY for the hidden password prompt. Do not place a password in shell history, an environment variable, SSM command parameters, logs, tickets, or chat. No new production secret is required for this bootstrap.

## Access checks

- No access token: `GET /api/v1/ops/session` returns `401`.
- Authenticated `user`: the endpoint returns `403 OPERATIONS_ADMIN_REQUIRED`, and `/ops` shows the access-denied screen.
- Authenticated `operations_admin`: the endpoint returns the administrator identity and the responsive console shell renders.
- Removing the role in PostgreSQL causes the same still-valid access token to receive `403` on the next operations API request.

This foundation does not include administrator assignment UI/API, gym mutations, media upload, notices, or notification delivery.
