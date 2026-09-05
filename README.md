# TopJug MVP

TopJug의 모바일 클라이밍 기록 앱을 Next.js로 포팅한 MVP입니다. 기존 React CSR 화면을 유지하면서 Next.js App Router가 웹과 향후 API의 실행 기반을 제공합니다.

## Local Development

Node.js 22와 npm을 사용합니다.

```bash
npm ci

# 터미널 1: 사용자 앱과 API (http://localhost:3000)
npm run dev:web

# 터미널 2: 운영 콘솔 (http://localhost:3001)
npm run dev:admin
```

두 명령 모두 저장소 루트의 기존 `.env.local`을 읽습니다. 앱 분리를 위해 환경 파일을 복사할 필요는 없습니다.

검증 명령:

```bash
npm run typecheck
npm run build
```

## Architecture

```text
apps/web/app/            사용자 Next.js 화면과 공유 API Route Handlers
apps/web/public/         사용자 앱 PWA·브랜드 정적 파일
apps/admin/app/          운영 콘솔 Next.js 진입점
apps/admin/src/          운영 콘솔 전용 React 화면과 라우터
src/app/                 사용자 CSR 애플리케이션과 providers
src/features/            사용자용 product features와 공유 인증
src/entities/            공유 client-side domain types
src/lib/api/             공유 frontend HTTP·인증 transport
src/server/              공유 API business logic와 DB 접근
ops/ec2/                 web/admin EC2 runtime과 배포 설정
```

`apps/web`과 `apps/admin`은 독립적으로 빌드·실행되는 npm workspace입니다. 사용자 앱은 `topjug.kr`, 운영 콘솔은 `ops.topjug.kr`에서 제공하며 운영 콘솔의 `/api/*` 요청은 Caddy가 동일한 web/API 서버로 전달합니다. PostgreSQL과 S3, 서버 비즈니스 로직은 공유합니다.

각 앱의 `app/[[...path]]`가 React Router 앱을 CSR로 감쌉니다. 백엔드 기능을 추가할 때 Route Handler에는 HTTP 처리만 두고 비즈니스 규칙은 `src/server` 아래의 독립 모듈에 둡니다.

## Brand Assets

공식 아이콘 원본은 [`apps/web/public/brand/topjug-icon-source.jpg`](./apps/web/public/brand/topjug-icon-source.jpg)입니다. 웹 favicon, 로그인·공유 화면, PWA 아이콘은 이 파일에서 생성하며 암장 로고에는 적용하지 않습니다.

네이티브 wrapper를 추가할 때도 이 원본에서 iOS AppIcon과 Android launcher/round/maskable 리소스를 생성합니다. 플랫폼 생성기는 원본 비율을 유지해야 하며 Android adaptive icon의 주요 도형은 중앙 safe zone 안에 두어야 합니다. 현재 웹 파생 파일은 `apps/web/public/icons/`에 있고 maskable 파일은 같은 원본을 75%로 축소한 뒤 흰 배경으로 패딩했습니다.

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

1. TypeScript 검사와 사용자·운영 콘솔 Next.js production build
2. standalone 산출물을 S3에 업로드
3. GitHub OIDC로 AWS IAM role 획득
4. AWS Systems Manager로 EC2 배포 명령 실행
5. `topjug-web`과 `topjug-admin` systemd 서비스 재시작 및 health check

Docker와 장기 AWS access key는 사용하지 않습니다. Caddy가 `topjug.kr`의 TLS 인증서와 reverse proxy를 담당합니다.
