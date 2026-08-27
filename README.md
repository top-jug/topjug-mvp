# TopJug MVP

TopJug의 모바일 클라이밍 기록 앱을 Next.js로 포팅한 MVP입니다. 기존 React CSR 화면을 유지하면서 Next.js App Router가 웹과 향후 API의 실행 기반을 제공합니다.

## Local Development

Node.js 22와 npm을 사용합니다.

```bash
npm ci
npm run dev
```

검증 명령:

```bash
npm run typecheck
npm run build
```

## Architecture

```text
app/                    Next.js routes and API adapters
src/app/                Existing CSR application and providers
src/features/           Product features
src/entities/           Client-side domain types
src/lib/api/            Shared frontend HTTP and auth transport
src/server/http/        Shared API boundary and error handling
ops/ec2/                EC2 runtime and deployment configuration
```

`app/[[...path]]`가 기존 React Router 앱을 CSR로 감쌉니다. 백엔드 기능을 추가할 때 Route Handler에는 HTTP 처리만 두고 비즈니스 규칙은 `src/server` 아래의 독립 모듈에 둡니다.

현재 서버 endpoint는 인증, 암장, 저장 암장, 회원권, 세팅 일정, 기록 lifecycle, 공유 API를 포함합니다. 전체 계약은 [`docs/backend/openapi.yaml`](./docs/backend/openapi.yaml)을 기준으로 연동합니다.

```text
GET /api/health
GET /api/ready
GET /api/v1/gyms
GET /api/v1/gyms/{gymId}
GET /api/v1/records
POST /api/v1/records/sessions
```

## Deployment

`main`에 push하면 GitHub Actions가 다음 순서로 배포합니다.

1. TypeScript 검사와 Next.js production build
2. standalone 산출물을 S3에 업로드
3. GitHub OIDC로 AWS IAM role 획득
4. AWS Systems Manager로 EC2 배포 명령 실행
5. systemd 서비스 재시작 및 health check

Docker와 장기 AWS access key는 사용하지 않습니다. Caddy가 `topjug.kr`의 TLS 인증서와 reverse proxy를 담당합니다.

## iOS wrapper

The iOS app is a Capacitor wrapper around `https://topjug.kr`, not a separately deployed mobile frontend. Synchronize the checked-in Swift Package Manager project with `npm run ios:sync` and open it with `npm run ios:open`.

Authentication remains on the existing same-origin web contract. Native OAuth, cookie, JWT, Keychain, or `WKWebsiteDataStore` changes require `tmin002` as a pull-request reviewer. See [`docs/mobile/ios-wrapper.md`](./docs/mobile/ios-wrapper.md) for the architecture decision, device verification matrix, and known production risks.
