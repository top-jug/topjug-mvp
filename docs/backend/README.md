# Backend foundation

TopJug MVP backend runs in the existing Next.js application. Route Handlers only translate HTTP requests; domain and persistence logic stays under `src/server`.

## Current scope

- PostgreSQL 16 and Drizzle ORM
- Email/password authentication with Argon2id and signed JWTs
- Rotating refresh sessions with reuse detection and server-side revocation
- Structured request logs, request IDs, and append-only audit events
- Record create, list, and detail APIs under `/api/v1/records`
- Shared API error boundary and Zod request validation
- Schema for users, gyms, gym grades, saved gyms, memberships, setting events, records, and route counts
- No frontend provider consumes these APIs yet

## Local setup

1. Create `.env.local` from `.env.local.example`.
2. Start the Docker PostgreSQL 16 service with `npm run local:up`.
3. Apply migrations with `npm run db:migrate:local`.
4. Seed gym and gym-grade IDs used by record requests. Users are created through `/api/v1/auth/register`.
5. Start the application with `npm run dev:local`.

The `local` profile uses the PostgreSQL container defined in `compose.yaml`; the Next.js process remains on the host for fast reloads. Stop the database with `npm run local:down`. `DATABASE_URL` is read lazily on the first API request, so a missing local database does not prevent the existing frontend from rendering.

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

## Observability

- Every API response includes `x-request-id`; a valid incoming UUID is preserved.
- Request start, completion, and failure logs are emitted as one-line JSON without bodies or credentials.
- Auth, user, and record service actions write append-only `audit_events` rows.
- Audit metadata is allow-listed scalar data and must not contain PII or tokens.

## Commands

```bash
npm run db:generate
npm run db:migrate
npm run local:up
npm run db:migrate:local
npm run dev:local
npm run test:integration:local
npm run typecheck
npm test
npm run build
```

Do not edit generated SQL migration files after they have been applied. Change `src/server/db/schema.ts` and generate a new migration instead.

## Documents

- [ERD and domain decisions](./erd.md)
- [OpenAPI contract](./openapi.yaml)
- [Low-cost RDS plan](./rds.md)
