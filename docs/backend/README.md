# Backend foundation

TopJug MVP backend runs in the existing Next.js application. Route Handlers only translate HTTP requests; domain and persistence logic stays under `src/server`.

## Current scope

- PostgreSQL 16 and Drizzle ORM
- Email/password authentication with Argon2id and signed JWTs
- Rotating refresh sessions with reuse detection and server-side revocation
- Structured request logs, request IDs, and append-only audit events
- Gym search/detail, saved-gym, setting-calendar, membership, record, and public-share APIs under `/api/v1`
- Shared API error boundary and Zod request validation
- Screen-complete schema for regions, gym provenance, S3 media metadata, prices, hours, tags, walls, sectors, setting events, memberships and usage ledgers, records, pauses, and shares
- No frontend provider consumes these APIs yet

## Local setup

1. Create `.env.local` from `.env.local.example`.
2. Start the Docker PostgreSQL 16 service with `npm run local:up`.
3. Apply migrations with `npm run db:migrate:local`.
4. Validate the researched gym archive with `npm run db:import:gyms:check`.
5. Import the 31 selected gyms and their S3 logos with `npm run db:import:gyms:local`. The researched `더클라임 신사` row is intentionally excluded. Users are created through `/api/v1/auth/register`.
6. Seed grades, walls, and sectors used by record requests, then start the application with `npm run dev:local`.

The `local` profile uses PostgreSQL and MinIO from `compose.yaml`; the Next.js process remains on the host for fast reloads. MinIO creates a public `topjug-media` bucket for the initial S3-compatible logo import. Stop local infrastructure with `npm run local:down`. `DATABASE_URL` is read lazily on the first API request, so a missing local database does not prevent the existing frontend from rendering.

## Screen data boundary

- Production gym images, logos, wall maps, sector maps, and generated share cards live in S3. PostgreSQL stores object keys and lifecycle metadata in `media_assets`.
- The initial importer uploads each gym logo to `MEDIA_S3_BUCKET` and reuses that asset for its single logo, cover, and first detail photo. Additional detail photos can be appended with increasing `sortOrder` values.
- Set `MEDIA_PUBLIC_BASE_URL` to the CloudFront or public S3 origin used to derive media URLs. Until configured, API media references return `url: null` while retaining the asset ID and storage key.
- Gym detail responses include operating-hour exceptions, source verification timestamps, grades, walls, sectors, maps, and setting schedules.
- CSV operating hours and parking notes are retained verbatim until reviewed. Day-pass and shoe-rental prices retain both a parsed KRW amount and their original text.
- Record creation requires real grade and sector UUIDs. Count memberships are validated and decremented with an append-only usage ledger in the same transaction.
- Live recording can be started, paused, resumed, completed, or cancelled through session lifecycle endpoints. The server derives active duration from pause intervals.
- Daily admission is `accessType=day_pass`; membership admission requires an eligible `membershipId`; unclassified admission is `other`.
- Share tokens are returned once, stored only as SHA-256 hashes, and can be revoked independently from their S3 image.

## Authentication boundary

- Access JWTs expire after 15 minutes and are returned for in-memory use as Bearer tokens.
- Refresh JWTs expire after 30 days and only use an HttpOnly, Secure, SameSite=Strict cookie.
- Every refresh rotates the token. Reusing a revoked token revokes the whole token family.
- PostgreSQL stores refresh token SHA-256 hashes, never raw tokens.
- Passwords use Argon2id with OWASP-aligned memory and iteration settings.
- Login errors do not reveal whether an email exists. Attempts use atomic email and client-address limits; registration uses client-address and global limits before Argon2 work.
- Concurrent or later reuse of a rotated refresh token revokes the token family and requires a new login.
- JWTs, passwords, refresh tokens, and raw login identifiers must never enter logs or audit metadata.

## Production secrets

The `production` profile requires `SSM_PARAMETER_PREFIX=/topjug/prod`. Next.js loads these SecureString values during server startup:

```text
/topjug/prod/database-url
/topjug/prod/jwt-access-secret
/topjug/prod/jwt-refresh-secret
/topjug/prod/auth-rate-limit-pepper
```

The EC2 role needs path-scoped `ssm:GetParameters`, `ssm:GetParameter` for the migration runner, and `kms:Decrypt` only when a customer-managed KMS key is used. Missing or empty parameters fail startup. Deployment applies packaged Drizzle migrations before switching the release symlink, then checks `/api/ready`, which verifies secrets and the database connection.

Initial gym data is a controlled one-time operation, not part of every deployment. On an operator machine with the researched ZIP, logo directory, production `DATABASE_URL`, `MEDIA_S3_BUCKET`, `MEDIA_PUBLIC_BASE_URL`, `AWS_REGION`, and S3 write credentials, run `npm run db:import:gyms:check` followed by `npm run db:import:gyms`. The importer uses deterministic S3 keys and database source IDs, so a retry does not duplicate gyms, assets, or media roles.

## Observability

- Every API response includes `x-request-id`; a valid incoming UUID is preserved.
- Request start, completion, and failure logs are emitted as one-line JSON without bodies or credentials.
- Auth, user, and record service actions write append-only `audit_events` rows.
- Audit metadata is allow-listed scalar data and must not contain PII or tokens.
- A daily systemd timer removes login attempts after 1 day, expired or revoked refresh sessions after 30 days, and audit events after 365 days in bounded batches.

## Commands

```bash
npm run db:generate
npm run db:migrate
npm run local:up
npm run db:migrate:local
npm run db:import:gyms:check
npm run db:import:gyms:local
npm run dev:local
npm run test:integration:local
npm run test:http:local
npm run typecheck
npm test
npm run build
```

Do not edit generated SQL migration files after they have been applied. Change `src/server/db/schema.ts` and generate a new migration instead.

## Documents

- [ERD and domain decisions](./erd.md)
- [OpenAPI contract](./openapi.yaml)
- [Low-cost RDS plan](./rds.md)
