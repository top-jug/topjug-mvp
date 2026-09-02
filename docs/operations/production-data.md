# Production Database And Media

TopJug production uses a private PostgreSQL RDS instance and a private S3 media bucket delivered through CloudFront OAC. The web runtime can write and delete only `gyms/uploads/*`; it cannot list or read the bucket and returns URLs derived from `MEDIA_PUBLIC_BASE_URL`.

## Managed Resources

CloudFormation stack: `topjug-mvp-production-data` in `ap-northeast-2`.

| Resource | Production value |
| --- | --- |
| RDS | `topjug-mvp-postgres` |
| Media bucket | `topjug-mvp-media-345736953998-ap-northeast-2` |
| CloudFront distribution | `E30DR57DQDZH5F` |
| Media origin | `https://media.topjug.kr` |
| Application instance role | `topjug-mvp-ec2-role` |
| Application instance | `i-0076602b269b8469f` |

The stack template is `ops/aws/production-data.yaml`. RDS is encrypted, private, deletion-protected, and limited to the application security group. The media bucket blocks all public access, uses versioning and SSE-S3, and grants object reads only to its CloudFront distribution.

The account's current Free Tier plan restricts automated RDS backup retention to one day. Increase `BackupRetentionPeriod` to at least 7 days immediately after upgrading the account plan. Manual snapshots are required before destructive migrations or controlled imports.

## Provisioning

CloudFront certificates must be issued in `us-east-1`. Request and DNS-validate `media.topjug.kr` before deploying the Seoul-region stack.

```bash
aws acm request-certificate \
  --region us-east-1 \
  --domain-name media.topjug.kr \
  --validation-method DNS

aws cloudformation deploy \
  --region ap-northeast-2 \
  --stack-name topjug-mvp-production-data \
  --template-file ops/aws/production-data.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    VpcId=<vpc-id> \
    AppSecurityGroupId=<app-security-group-id> \
    DatabaseSubnetIds='<subnet-a>,<subnet-b>' \
    AppInstanceRoleName=topjug-mvp-ec2-role \
    AppInstanceId=<app-instance-id> \
    GithubDeployRoleName=topjug-mvp-github-deploy-role \
    HostedZoneId=<topjug.kr-zone-id> \
    MediaCertificateArn=<us-east-1-certificate-arn> \
    MediaBucketName=topjug-mvp-media-345736953998-ap-northeast-2
```

Do not create a second stack with the same explicit bucket or database names. Update this stack in place.

Enable CloudFormation termination protection after initial creation:

```bash
aws cloudformation update-termination-protection \
  --region ap-northeast-2 \
  --stack-name topjug-mvp-production-data \
  --enable-termination-protection
```

Do not disable termination protection during routine updates. Never change `DatabaseIdentifier`, `DatabaseName`, `DatabaseUsername`, or another replacement-sensitive RDS property in a routine stack update while deletion protection is enabled. A replacement or intentional stack deletion requires a maintenance window: stop application writes, take and verify a final snapshot, disable RDS deletion protection through a reviewed stack update, perform the replacement or disable stack termination protection and delete the stack, then re-enable both protections. Deletion protection otherwise leaves replacement cleanup or stack deletion in a failed state.

## Runtime Secrets

Store these values as SSM `SecureString` parameters. The application instance role may read only the runtime URL and the three application secrets; the GitHub deployment role may additionally read the migration URL:

```text
/topjug/prod/runtime-database-url
/topjug/prod/migration-database-url
/topjug/prod/jwt-access-secret
/topjug/prod/jwt-refresh-secret
/topjug/prod/auth-rate-limit-pepper
```

Database URLs must use percent-encoded credentials and `sslmode=require`. The deployment tunnel connects to localhost and therefore does not support hostname-based `sslmode=verify-full` verification:

```text
postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/topjug?sslmode=require
```

RDS manages its master password in Secrets Manager. Store the schema-owner URL as `migration-database-url`. Generate a separate password of at least 32 random bytes for `topjug_app` and store that URL as `runtime-database-url`. The deployment workflow runs the bundled `provision-runtime-db-role.cjs --apply` through its private SSM tunnel before migration. The role receives connect, schema usage, table DML, and sequence usage but cannot modify the schema. Future tables and sequences inherit the same grants.

The application instance role can read the runtime URL and application secrets and can put/delete objects only under `gyms/uploads/*`. It has no media read or bucket-list permission. The GitHub OIDC deployment role can read both database URLs; CI opens a short-lived SSM port-forwarding session through EC2, converges and verifies the runtime role, and runs migrations before sending the release command. After this workflow has deployed successfully, delete the legacy `/topjug/prod/database-url` parameter. Never grant the instance role access to `migration-database-url`.

Do not attach AWS managed `AmazonSSMManagedInstanceCore` to the application role. That policy grants `ssm:GetParameter` and `ssm:GetParameters` on `*`, bypassing the scoped runtime policy. `ApplicationSsmAgentCorePolicy` provides the required agent and message-channel actions without Parameter Store access.

Never print either URL, place it in shell history, or commit it to a file. JWT secrets and the rate-limit pepper must each contain at least 32 random bytes. Parameter creation and rotation must be performed with a temporary administrator role, not a long-lived root access key.

## Deployment And Migration

Production deployment opens a short-lived SSM tunnel through EC2, applies `drizzle/` migrations from the GitHub runner, sends the release command to EC2, starts the service, then checks local `/api/ready`.

For the credential-isolation rollout, first attach the `GithubMigrationPolicy` statements to the GitHub OIDC role under a distinct temporary name such as `topjug-mvp-bootstrap-production-migrations`. This one-time bootstrap lets the tunnel-based workflow deploy while the existing stack still has its broad instance policy. After that release is healthy, apply `topjug-mvp-production-data`, verify CloudFormation created `topjug-mvp-run-production-migrations`, then delete the temporary policy. Detach `AmazonSSMManagedInstanceCore`, confirm the instance remains online in SSM, restart the service, verify runtime access and migration access denial, then delete `/topjug/prod/database-url`.

The production credential-isolation rollout completed on 2026-08-24: the service restarted with `topjug_app`, migration and legacy parameter reads were denied from EC2, and the legacy parameter was deleted.

## Operations Media Uploads

The runtime uses `AWS_REGION=ap-northeast-2`, `MEDIA_S3_BUCKET=topjug-mvp-media-345736953998-ap-northeast-2`, and `MEDIA_PUBLIC_BASE_URL=https://media.topjug.kr`. Do not set `MEDIA_S3_ENDPOINT`, path-style access, or AWS access-key environment variables in production; the AWS SDK uses `topjug-mvp-ec2-role` credentials.

Apply the existing `topjug-mvp-production-data` CloudFormation stack before deploying the first upload-capable release. The additive `ApplicationMediaUploadPolicy` grants only `s3:PutObject` and `s3:DeleteObject` on `gyms/uploads/*`; do not add `s3:ListBucket`, `s3:GetObject`, or a broad managed S3 policy.

Uploads use immutable keys of the form `gyms/uploads/<UTC year>/<UTC month>/<UUID>.webp`. The API creates a pending database row, uploads the normalized WebP, and marks the row ready. Failed uploads are marked for deletion and removed when S3 cleanup succeeds. `topjug-media-cleanup.timer` retries deleted objects, removes pending uploads older than one hour, and removes ready assets that remain unattached for 24 hours. Direct S3 URLs remain private; CloudFront serves ready assets attached to a gym. Caddy permits the 11 MB request limit only for `POST /api/v1/ops/media/images` and `POST /api/v1/ops/gyms/*/media`; all other request bodies retain the 64 KB limit.

Before a destructive migration:

1. Confirm the current RDS state is `available`.
2. Create a manual snapshot and wait until it is `available`.
3. Test the migration against a restored copy when production contains user data.
4. Run the deployment once and retain the SSM command ID.
5. Verify `/api/health`, a representative API query, and service logs.

Code rollback does not reverse an applied database migration. Restore from snapshot only after stopping writes and confirming the data-loss boundary.

## Initial Gym Import

The production RDS is private. Run the importer on the application EC2 instance through SSM, not from an internet-connected workstation.

Required controls:

1. Run `npm run db:import:gyms:check` locally.
2. Create and wait for a manual pre-import RDS snapshot.
3. Build `.migration/import-initial-gyms.cjs` with `npm run build:migrate`.
4. Upload the importer and source archives to a short-lived private deployment-bucket prefix.
5. Temporarily grant the EC2 role `s3:GetObject` and `s3:PutObject` on `gyms/initial/*`, plus `s3:ListBucket` restricted by the same prefix.
6. Execute the importer as user `topjug` with `APP_PROFILE=production`, `SSM_PARAMETER_PREFIX=/topjug/prod`, `MEDIA_S3_BUCKET`, `MEDIA_PUBLIC_BASE_URL`, and `--apply`.
7. Execute it a second time and require `uploadedObjects: 0` and `reusedObjects: 31`.
8. Delete the temporary IAM policy, EC2 files, and every version of the deployment-bucket source artifacts.

The dry-run requires all 31 deterministic source external IDs to have a reviewed mapping. Apply mode additionally requires every mapped code to exist at level 2 with a level-1 parent. Both insert and update paths set `gyms.region_code`; importer verification requires `assigned_regions=31`.

The importer must report:

```text
gyms=31
brands=7
assets=31
logos=31
covers=31
photos=31
sharedAssetGyms=31
```

`더클라임 신사` is intentionally excluded because no reviewed logo was available. Each imported gym uses one immutable logo asset for its `logo`, `cover`, and first `photo` roles.

## Verification

After import and deployment:

1. `GET https://topjug.kr/api/health` returns 200.
2. `GET https://topjug.kr/api/v1/gyms?limit=100` returns exactly 31 initial gyms.
3. `GET https://topjug.kr/api/v1/regions` contains 17 level-1 regions and only level-2 rows with valid parents.
4. All 31 source gyms have a non-null level-2 `region_code`; `regionCode=11` includes Seoul districts and `regionCode=11110` only includes 종로구.
5. Every gym detail has one logo, cover, and first photo relationship.
6. Every `https://media.topjug.kr/gyms/initial/.../logo.jpg` returns 200 with `image/jpeg`.
7. The equivalent direct S3 URL returns 403.
8. The EC2 role can write only `gyms/uploads/*`; it cannot write `gyms/initial/*`, list the bucket, or read objects.
9. The deployment-bucket import prefix has no retained versions or delete markers.

Production verification completed on 2026-08-23:

```text
RDS snapshot: topjug-mvp-pre-initial-import-20260823 (available, encrypted)
First import: uploadedObjects=31, reusedObjects=0
Second import: uploadedObjects=0, reusedObjects=31
CloudFront HEAD: 31 successful, 0 failed
Private S3 direct access: 403
```

## Recovery

If database import verification fails before user writes begin, stop the application and restore `topjug-mvp-pre-initial-import-20260823` to an isolated RDS instance for inspection. Do not blindly delete gyms because the importer can update an existing gym matched by its source identifier.

S3 objects use deterministic keys and immutable cache headers. A checksum mismatch must fail rather than overwrite an existing key. For corrected media, use a new versioned key and update the database relationship; do not invalidate immutable content in place.
