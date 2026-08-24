# Frontend API Client

프론트엔드의 모든 API 요청은 `src/lib/api`의 공통 client를 사용한다. 서버 계약은 `docs/backend/openapi.yaml`이 기준이며 도메인별 endpoint 함수와 응답 타입은 각 feature가 소유한다.

## Usage

```ts
import { apiRequest, type ApiDataResponse } from '@/src/lib/api';

type Gym = { id: string; name: string };

export async function getGym(gymId: string) {
  const response = await apiRequest<ApiDataResponse<Gym>>(`/gyms/${gymId}`, {
    auth: 'none',
  });
  return response.data;
}
```

인증이 필요한 endpoint는 `auth`를 생략하거나 `auth: 'required'`를 지정한다. 공개 endpoint는 `auth: 'none'`, 로그인 여부에 따라 bearer token만 선택적으로 보내려면 `auth: 'optional'`을 사용한다.

POST 요청은 body를 JSON 문자열로 전달한다. client가 `Accept`, `Content-Type`, `credentials`, bearer token과 request ID를 일관되게 설정한다.

```ts
return apiRequest<ApiDataResponse<Membership>>('/memberships', {
  method: 'POST',
  body: JSON.stringify(input),
});
```

## Errors

실패는 `ApiClientError`로 변환된다. 화면에서는 서버의 사용자용 `message`를 표시할 수 있고, 분기가 필요할 때 `status`와 `code`를 사용한다. 운영 문의를 위해 `requestId`를 함께 기록할 수 있다. password, token, cookie, request body는 로그로 남기지 않는다.

```ts
import { isApiClientError } from '@/src/lib/api';

try {
  await createMembership(input);
} catch (error) {
  if (isApiClientError(error) && error.code === 'MEMBERSHIP_CONFLICT') {
    // Render the domain-specific conflict state.
  }
}
```

## Authentication

- access token은 module memory에만 보관하며 browser storage나 JavaScript cookie에 저장하지 않는다.
- refresh token은 서버가 설정한 HttpOnly cookie이며 프론트에서 읽지 않는다.
- reload 시 refresh 후 `/me`를 조회해 인증 상태를 복구한다.
- 여러 protected request가 동시에 refresh를 요구해도 한 요청만 실행한다.
- protected request의 401은 refresh 후 최대 한 번만 재시도한다.
- logout은 네트워크 결과와 무관하게 local token과 사용자 상태를 즉시 제거한다.
- 다른 browser tab 사이의 refresh lock은 아직 지원하지 않는다. 동일 계정을 여러 tab에서 동시에 장시간 사용하는 경우 refresh rotation이 충돌할 수 있다.

도메인 feature는 token getter, refresh 호출 또는 인증 storage를 별도로 구현하지 않는다. 사용자 상태가 필요한 화면은 `useAuth()`를 사용한다.
