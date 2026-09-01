# Operations console runbook

The operations console is served at `/ops` outside the mobile preview layout. Both the client route and every operations API enforce the `operations_admin` role. The server reads the current role from PostgreSQL for each operations request, so demotion takes effect without waiting for an access token to expire.

## Local verification

When `ops-review@example.com` already exists, reuse it and skip the administrator creation steps below. Do not create a replacement review account for operating-hours verification.

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

## Operating-hours verification

Sign in with the existing `ops-review@example.com` operations administrator, open `/ops/gyms`, choose a gym, and select **운영시간 관리**.

- Weekly hours support a closed day or up to eight ordered, non-overlapping intervals per weekday.
- Date exceptions take priority over the weekly schedule for that date. An existing date exception must be deleted before registering a different one.
- Range exceptions expand to one row set per date for at most 92 days. Existing exceptions return `OPERATING_HOUR_OVERRIDE_EXISTS`; the console only replaces them after the operator chooses the explicit overwrite action.
- `정상 운영` describes the gym lifecycle, not whether its doors are open right now. Public screens derive `오늘 휴무`, `영업 중`, `영업 전`, `브레이크 타임`, or `영업 종료` from the Seoul-time effective schedule; temporary closure, closure, and opening-soon lifecycle states take priority.
- Every mutation uses the gym `updatedAt` version, updates the public gym detail immediately, and records `ops.gym.hours.update` in the audit log.

## Media pipeline verification

The media pipeline is API-only in this issue; the operations photo UI and gym attachment arrive in the next issue. Reuse `ops-review@example.com`, obtain its access token through the normal login flow, and upload one file as the `file` multipart field to `POST /api/v1/ops/media/images`.

- JPEG, PNG, and WebP inputs up to 10 MiB are decoded and converted to metadata-free WebP.
- Images are limited to 40 million input pixels and 12000px per side, then reduced to at most 2560px per side.
- The response is a ready media asset under `gyms/uploads/<year>/<month>/<uuid>.webp`; it is not attached to a gym yet.
- A damaged file, mismatched MIME type, extra multipart field, or oversized body is rejected before S3 upload.
- `npm run media:cleanup:local` previews stale pending and unattached assets. Append `-- --apply` only when intentionally cleaning the local MinIO data.

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

## Gym keyword management

Use `/ops/gym-tags` to create, edit, activate, deactivate, and delete unassigned search keywords. The same screen replaces the complete keyword assignment for a selected gym with optimistic concurrency. Deactivating a keyword preserves assignments but removes it from `GET /api/v1/gym-tags`, public gym responses, and search results.

Migration `0006_operations_gym_tags.sql` backfills existing `gyms.facilities` values into the keyword dictionary and assignment table. Known facility codes receive Korean labels and stable codes; other non-empty values receive deterministic `facility_<hash>` codes without removing the legacy source array.

For review, reuse the existing `ops-review@example.com` operations account. Do not run the bootstrap command to create another review account.

The console does not include administrator assignment UI/API, photo upload UI or gym attachment, notices, or notification delivery.
