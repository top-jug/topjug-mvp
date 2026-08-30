# Backend foundation

TopJug MVP backend runs in the existing Next.js application. Route Handlers only translate HTTP requests; domain and persistence logic stays under `src/server`.

> Deployment boundary: `/auth/register` requires an email verification token. This backend commit must reach production atomically with the stacked issue #87 registration UI; deploying it alone breaks new-account creation. Production email activation also remains gated on issue #82.

## Current scope

- PostgreSQL 16 and Drizzle ORM
- Email/password authentication with Argon2id and signed JWTs
- Rotating refresh sessions with reuse detection and server-side revocation
- Purpose-bound email verification and password reset with one-time tokens
- Structured request logs, request IDs, and append-only audit events
- Gym search/detail, saved-gym, setting-calendar, membership, record, and public-share APIs under `/api/v1`
- Shared API error boundary and Zod request validation
- Screen-complete schema for regions, gym provenance, S3 media metadata, prices, hours, tags, walls, sectors, setting events, memberships and usage ledgers, records, pauses, and shares
- Frontend auth, gym, saved-gym, membership, calendar, record, and share flows consume these APIs through the shared client in `src/lib/api`.

## Local setup

1. Create `.env.local` from `.env.local.example`.
2. Start the Docker PostgreSQL 16 service with `npm run local:up`.
3. Apply migrations with `npm run db:migrate:local`.
4. Validate the researched gym archive with `npm run db:import:gyms:check`.
5. Import the 31 selected gyms and their S3 logos with `npm run db:import:gyms:local`. The researched `더클라임 신사` row is intentionally excluded. Users are created through `/api/v1/auth/register`.
6. Start the application with `npm run dev:local`. Integration and HTTP tests create their own grade, wall, and sector fixtures; local manual record testing requires equivalent rows for the selected gym.

The local environment example configures delivery to the permission-restricted `.topjug/mail-sink.jsonl` file. Request a code through `/api/v1/auth/email-verifications`, read the latest local sink entry, and confirm it without AWS credentials. Never use the file adapter in production; production readiness accepts only `EMAIL_DELIVERY_MODE=ses` with `EMAIL_FROM_ADDRESS`. The sink refuses symlinked paths and enforces `0700` directory and `0600` file modes.

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

## API contract conventions

- Run `npm run lint:openapi` after changing `docs/backend/openapi.yaml`; CI runs the same pinned Redocly CLI.
- Successful `/api/v1` JSON responses use a `data` envelope. List pagination metadata is returned separately in `meta` where applicable; `/api/health` and `/api/ready` are unenveloped probes.
- Every response produced by a documented API handler has `x-request-id` and `Cache-Control: no-store`. Framework-generated responses for unknown routes or unsupported methods are outside this guarantee. Authentication responses can also set or clear `topjug_refresh`; 401 errors have `WWW-Authenticate`, and 429 errors have `Retry-After`.
- Error `code` values are stable machine-readable identifiers. Error `message` values are user-facing and may change or be localized; clients must branch on `code`, not `message`.
- A property documented as nullable is returned as JSON `null` when the service includes it without a value. Optional request properties may be omitted. Response properties not marked required may be omitted; clients must distinguish omission from an explicit `null`.
- Record pages contain completed records only and are ordered by `createdAt` descending, then `id` descending. Their `sends` and `attempts` are aggregate totals over count rows, and `nextCursor` is an opaque continuation for that ordering.
- Record detail may expose `in_progress`, `completed`, or `cancelled` records. Pause, resume, complete, count replacement, and cancel operations narrow that lifecycle further as documented by each operation.
- Expired active shares are classified virtually at read time. Listing reports them as `expired`, public resolution returns structured `410 SHARE_EXPIRED`, and the persisted status can remain `active`.

### Stable domain errors

| Domain | Stable codes clients commonly handle |
| --- | --- |
| Authentication | `ACCOUNT_UNAVAILABLE`, `INVALID_CREDENTIALS`, `INVALID_EMAIL_VERIFICATION`, `EMAIL_DELIVERY_FAILED`, `EMAIL_VERIFICATION_RATE_LIMITED`, `PASSWORD_RESET_RATE_LIMITED`, `MISSING_ACCESS_TOKEN`, `INVALID_ACCESS_TOKEN`, `MISSING_REFRESH_TOKEN`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REUSED`, `LOGIN_RATE_LIMITED`, `REGISTRATION_RATE_LIMITED`, `REFRESH_RATE_LIMITED`, `LOGOUT_RATE_LIMITED` |
| Gym | `GYM_NOT_FOUND` |
| Membership | `INVALID_MEMBERSHIP_GYMS`, `MEMBERSHIP_NOT_FOUND`, `MEMBERSHIP_CHANGED`, `HOME_MEMBERSHIP_LIMIT`, `HOME_MEMBERSHIP_ORDER_OCCUPIED`, `MEMBERSHIP_TYPE_LOCKED`, `MEMBERSHIP_GYM_LOCKED`, `MEMBERSHIP_IN_USE` |
| Record | `ACTIVE_RECORD_EXISTS`, `ACTIVE_RECORD_NOT_FOUND`, `RECORD_NOT_FOUND`, `RECORD_ALREADY_PAUSED`, `RECORD_NOT_PAUSED`, `INVALID_PAUSE_TIME`, `INVALID_RESUME_TIME`, `INVALID_END_TIME`, `INVALID_PAUSE_RANGE`, `INVALID_ACTIVE_DURATION`, `INVALID_CANCEL_TIME`, `MEMBERSHIP_ARCHIVED`, `MEMBERSHIP_GYM_MISMATCH`, `MEMBERSHIP_NOT_ACTIVE`, `MEMBERSHIP_EXHAUSTED`, `GRADE_GYM_MISMATCH`, `SECTOR_GYM_MISMATCH`, `INVALID_CURSOR` |
| Share | `INVALID_SHARE_MEDIA`, `INVALID_SHARE_MEDIA_TYPE`, `SHARE_NOT_FOUND`, `SHARE_EXPIRED`, `SHARE_MEDIA_NOT_FOUND` |
| Service | `INVALID_REQUEST`, `INVALID_JSON`, `REQUEST_TOO_LARGE`, `DATABASE_NOT_CONFIGURED`, `AUTH_NOT_CONFIGURED`, `SERVICE_NOT_READY`, `INTERNAL_SERVER_ERROR` |

### Record lifecycle

| Current state | Operation | Result | Conflict or invalid transition |
| --- | --- | --- | --- |
| No active record | Start | `in_progress` | `ACTIVE_RECORD_EXISTS` if one already exists |
| `in_progress`, running | Pause | `in_progress`, paused | `RECORD_ALREADY_PAUSED` |
| `in_progress`, paused | Resume | `in_progress`, running | `RECORD_NOT_PAUSED` |
| `in_progress` | Replace counts | `in_progress` | Grade/sector mismatch codes |
| `in_progress` | Complete | `completed` | Invalid time/range or `MEMBERSHIP_EXHAUSTED` |
| `in_progress` | Cancel | `cancelled` | Invalid cancellation time |

After completion or cancellation, active-session transitions return `ACTIVE_RECORD_NOT_FOUND`. Completion consumes a count membership atomically; cancellation does not.

## Known API limitations

- Gym search returns at most 100 gyms and has no cursor or total count. `regionCode` is a canonical physical administrative-region subtree filter and is applied with `q`, facility, and tag filters before the limit. `/api/v1/regions` supplies the two-level catalog.
- Record-list `sends` and `attempts` are per-record aggregates computed in the page query; the API does not expose cross-page totals.
- Membership validity is represented as timezone-aware instants, not local calendar dates. Updates are full replacements and require the last observed `updatedAt` as `expectedUpdatedAt`; stale updates return `409 MEMBERSHIP_CHANGED`.
- Memberships can reference multiple gyms, while the current frontend editor exposes one gym selection. API clients that manage multi-gym memberships must preserve the full `gymIds` array.
- The API exposes media metadata and references but no media upload endpoint.
- Easy-mode clients assume one logical sector selection even though the API still requires a real `gymSectorId`; the server does not infer a sector.
- Frontend transport types are currently maintained by hand and responses are not runtime-validated against OpenAPI. Required fields must not be defaulted when adapting responses.

## Authentication boundary

- Access JWTs expire after 15 minutes and are returned for in-memory use as Bearer tokens.
- Refresh JWTs expire after 30 days and use an HttpOnly, SameSite=Strict cookie that is Secure in production.
- Every refresh rotates the token. Reusing a revoked token revokes the whole token family.
- PostgreSQL stores refresh token SHA-256 hashes, never raw tokens.
- Passwords use Argon2id with OWASP-aligned memory and iteration settings.
- New registration and reset passwords are 8-128 characters and must contain at least two of uppercase ASCII letters, digits, or ASCII special characters. Login continues to accept existing passwords.
- Email codes expire after 10 minutes, allow five incorrect attempts, and are bound to the normalized email and `register` or `reset_password` purpose. Verified tokens expire after 15 minutes and are consumed atomically with registration or reset.
- Requesting another code does not invalidate delivered codes. Only successful ownership proof retires sibling codes; failed delivery retires only its pending challenge. Request and confirmation rate limits are isolated by purpose.
- Password reset revokes every refresh session. Stateless access tokens already issued before reset cannot be revoked and retain a residual lifetime of at most 15 minutes.
- Password reset, login session issuance, and refresh rotation take the same transaction-scoped user lock. Login re-reads and verifies the current password while holding that lock, so neither login nor rotation can create a session after a concurrent reset revocation.
- Verification requests do not disclose account existence. A challenge is marked delivered only after the configured adapter succeeds; delivery failures return `EMAIL_DELIVERY_FAILED`, invalidate the challenge, and are never reported as accepted.
- Login errors do not reveal whether an email exists. Registration and password reset each atomically consume independent 15-minute limits before Argon2 work: 10 attempts per client address and 100 attempts globally. The reset limits do not use account or email keys, and registration exhaustion does not consume the reset budget.
- Concurrent or later reuse of a rotated refresh token revokes the token family and requires a new login.
- JWTs, passwords, refresh tokens, and raw login identifiers must never enter logs or audit metadata.

## Production secrets

The `production` profile requires `SSM_PARAMETER_PREFIX=/topjug/prod`. Next.js loads these SecureString values during server startup:

```text
/topjug/prod/runtime-database-url
/topjug/prod/migration-database-url
/topjug/prod/jwt-access-secret
/topjug/prod/jwt-refresh-secret
/topjug/prod/auth-rate-limit-pepper
```

The runtime URL uses the restricted `topjug_app` role; the migration URL uses the schema owner and is readable only by the GitHub OIDC deployment role. The EC2 role has explicit read access to the four runtime parameters, not the whole production path. CI applies packaged Drizzle migrations through a short-lived SSM database tunnel before sending the release command, then deployment checks `/api/ready`, which verifies secrets and the runtime database connection.

Production systemd config sets `EMAIL_DELIVERY_MODE=ses` and `EMAIL_FROM_ADDRESS=no-reply@topjug.kr`; these non-secret settings are not stored in SSM. The infrastructure stack provisions the SES identity, DKIM DNS records, runtime send permission, and deployment-role inspection permission. CI gates upload and migration on production access, identity, and DKIM readiness. The EC2 release script then performs a live send to the SES success simulator before switching the current release symlink. This activation path depends on #82 and must be released together with #87.

Initial gym data is a controlled one-time operation, not part of every deployment. Production RDS is private, so run the bundled importer on EC2 through SSM with `SSM_PARAMETER_PREFIX`, `MEDIA_S3_BUCKET`, `MEDIA_PUBLIC_BASE_URL`, and an explicit `--apply`. Grant media write access only for the import and remove it afterward. The importer verifies the expected 31 gyms, reviewed second-level physical regions, 7 brands, 31 assets, and 93 media roles; a second run must upload no objects. See the [production database and media runbook](../operations/production-data.md).

## Observability

- Every API response includes `x-request-id`; a valid incoming UUID is preserved.
- Request start, completion, and failure logs are emitted as one-line JSON without bodies or credentials.
- Auth, user, and record service actions write append-only `audit_events` rows.
- Audit metadata is allow-listed scalar data and must not contain PII or tokens.
- A daily systemd timer removes login attempts after 1 day, expired or revoked refresh sessions after 30 days, and audit events after 365 days in bounded batches.
- The same cleanup removes expired email challenges after a 1-day grace period.

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
npm run lint:openapi
npm run typecheck
npm test
npm run build
```

Do not edit generated SQL migration files after they have been applied. Change `src/server/db/schema.ts` and generate a new migration instead.

## Documents

- [ERD and domain decisions](./erd.md)
- [OpenAPI contract](./openapi.yaml)
- [Low-cost RDS plan](./rds.md)
- [Production database and media runbook](../operations/production-data.md)
