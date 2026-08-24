# Low-cost PostgreSQL RDS plan

Create a dedicated PostgreSQL 16 instance for the MVP rather than sharing another application's database.

## Recommended configuration

| Setting | Value | Reason |
| --- | --- | --- |
| Engine | PostgreSQL 16 | Matches the schema and existing infrastructure direction |
| Instance | `db.t4g.micro` | Lowest-cost Graviton option suitable for initial traffic |
| Availability | Single-AZ | Avoids the cost of a standby instance during MVP |
| Storage | 20 GB gp3 | Minimum practical encrypted RDS storage |
| Storage autoscaling | Enabled up to 100 GB | Prevents storage exhaustion while keeping the initial allocation at 20 GB |
| Public access | Disabled | Application access only through the existing VPC security group |
| Encryption | Enabled | Protects data at rest with the default AWS-managed key |
| Backup retention | 1 day currently, 7+ days after account upgrade | The current AWS Free Tier plan rejects longer retention; manual snapshots are mandatory before risky operations |
| Performance Insights | Disabled | Not needed for initial traffic |
| Enhanced monitoring | Disabled | CloudWatch's default metrics are sufficient initially |
| Multi-AZ/read replica | Disabled | No initial availability or read-scaling requirement |
| RDS Proxy | Disabled | Avoids another fixed monthly cost |
| Deletion protection | Enabled after connectivity is verified | Prevents accidental production deletion |
| Final snapshot | Required for production deletion | Keeps a recovery point when intentionally replacing the DB |

AWS pricing changes by region and usage. Confirm the estimate in the AWS Pricing Calculator immediately before provisioning. The database must use the same VPC, subnet routing, and an inbound security-group rule limited to the application security group on port 5432.

## Application settings

Next.js loads production secrets from AWS Systems Manager Parameter Store during startup. Store each value as a `SecureString`:

```text
/topjug/prod/runtime-database-url
/topjug/prod/migration-database-url
/topjug/prod/jwt-access-secret
/topjug/prod/jwt-refresh-secret
/topjug/prod/auth-rate-limit-pepper
```

- Configure only `SSM_PARAMETER_PREFIX=/topjug/prod` and `AWS_REGION=ap-northeast-2` as non-secret runtime values.
- Both database URL values use `postgresql://USER:PASSWORD@HOST:5432/topjug?sslmode=require`.
- `runtime-database-url` uses the restricted `topjug_app` role. `migration-database-url` uses the schema owner and is not loaded into the web process.
- Grant the application instance role `ssm:GetParameters` and `ssm:GetParameter` only for the runtime URL and application secrets. It must not read the migration URL.
- Use the template's custom SSM agent policy. Do not attach `AmazonSSMManagedInstanceCore`, which includes wildcard Parameter Store reads.
- Start with `DATABASE_POOL_SIZE=5` because both the EC2 application and `db.t4g.micro` are small.
- The GitHub OIDC deployment role fetches both database URLs, verifies the restricted role and applies migrations through a short-lived SSM tunnel, then EC2 checks readiness using the runtime role.
- Do not expose the RDS endpoint publicly for local development. Use the PostgreSQL 16 container in `compose.yaml`.

## Provisioning boundary

The active standalone production resources are managed by `ops/aws/production-data.yaml`. The existing `top-jug/infrastructure` repository contains an RDS module, but its documented ECS architecture differs from the deployed standalone Next.js application and is not the source of truth for this deployment. See the [production database and media runbook](../operations/production-data.md) for provisioning, import, verification, and recovery procedures.
