# Low-cost PostgreSQL RDS plan

Create a dedicated PostgreSQL 16 instance for the MVP rather than sharing another application's database.

## Recommended configuration

| Setting | Value | Reason |
| --- | --- | --- |
| Engine | PostgreSQL 16 | Matches the schema and existing infrastructure direction |
| Instance | `db.t4g.micro` | Lowest-cost Graviton option suitable for initial traffic |
| Availability | Single-AZ | Avoids the cost of a standby instance during MVP |
| Storage | 20 GB gp3 | Minimum practical encrypted RDS storage |
| Storage autoscaling | Disabled initially | Prevents an unexpected storage ceiling increase |
| Public access | Disabled | Application access only through the existing VPC security group |
| Encryption | Enabled | Protects data at rest with the default AWS-managed key |
| Backup retention | 1 day | Keeps basic recovery while minimizing backup storage |
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
/topjug/prod/database-url
/topjug/prod/jwt-access-secret
/topjug/prod/jwt-refresh-secret
/topjug/prod/auth-rate-limit-pepper
```

- Configure only `SSM_PARAMETER_PREFIX=/topjug/prod` and `AWS_REGION=ap-northeast-2` as non-secret runtime values.
- The database URL value uses `postgresql://USER:PASSWORD@HOST:5432/topjug?sslmode=require`.
- Grant the application instance role path-scoped `ssm:GetParameters` and `ssm:GetParameter`; do not grant wildcard write access.
- Start with `DATABASE_POOL_SIZE=5` because both the EC2 application and `db.t4g.micro` are small.
- The packaged deployment runner fetches only `database-url`, applies migrations before switching the release symlink, and then checks database readiness.
- Do not expose the RDS endpoint publicly for local development. Use the PostgreSQL 16 container in `compose.yaml`.

## Provisioning boundary

The existing `top-jug/infrastructure` repository already contains an RDS module, but its documented ECS architecture differs from the currently deployed standalone Next.js application. Provisioning should be a separate infrastructure issue that first confirms the active VPC and application security group. This application branch only defines the required database contract.
