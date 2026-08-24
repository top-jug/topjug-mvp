import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient } from '../../src/lib/api/client';
import { ApiClientError } from '../../src/lib/api/error';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

test('the native fetch implementation is called without a class receiver', async () => {
  const fetchImplementation = function (this: unknown) {
    assert.equal(this, undefined);
    return Promise.resolve(jsonResponse({ data: 'ok' }));
  };
  const client = new ApiClient(fetchImplementation as typeof fetch);
  await client.request('/public', { auth: 'none' });
});

test('an aborted request preserves the native AbortError', async () => {
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const client = new ApiClient((async () => {
    throw abortError;
  }) as typeof fetch);

  await assert.rejects(client.request('/public', { auth: 'none' }), (error) => error === abortError);
});

test('protected concurrent requests share one rotating refresh request', async () => {
  let refreshRequests = 0;
  let releaseRefresh: (() => void) | undefined;
  const refreshReady = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  const authorizations: string[] = [];
  const fetchImplementation = async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/auth/refresh')) {
      refreshRequests += 1;
      await refreshReady;
      return jsonResponse({ data: { accessToken: 'shared-token', accessTokenExpiresIn: 900 } });
    }
    authorizations.push(new Headers(init?.headers).get('Authorization') ?? '');
    return jsonResponse({ data: path });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch, () => '00000000-0000-4000-8000-000000000001');

  const first = client.request('/first');
  const second = client.request('/second');
  releaseRefresh?.();
  await Promise.all([first, second]);

  assert.equal(refreshRequests, 1);
  assert.deepEqual(authorizations, ['Bearer shared-token', 'Bearer shared-token']);
});

test('a protected 401 refreshes and retries the original request once', async () => {
  const calls: string[] = [];
  const fetchImplementation = async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    const authorization = new Headers(init?.headers).get('Authorization') ?? 'none';
    calls.push(`${path}:${authorization}`);
    if (path.endsWith('/auth/refresh')) {
      return jsonResponse({ data: { accessToken: 'new-token', accessTokenExpiresIn: 900 } });
    }
    if (authorization === 'Bearer old-token') {
      return jsonResponse({ error: { code: 'INVALID_ACCESS_TOKEN', message: 'expired' } }, { status: 401 });
    }
    return jsonResponse({ data: 'ok' });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch, () => '00000000-0000-4000-8000-000000000002');
  client.setAccessToken('old-token');

  const response = await client.request<{ data: string }>('/protected');

  assert.deepEqual(response, { data: 'ok' });
  assert.deepEqual(calls, [
    '/api/v1/protected:Bearer old-token',
    '/api/v1/auth/refresh:none',
    '/api/v1/protected:Bearer new-token',
  ]);
});

test('structured API errors retain status, code, request ID, and retry timing', async () => {
  const fetchImplementation = async () =>
    jsonResponse(
      { error: { code: 'LOGIN_RATE_LIMITED', message: '잠시 후 다시 시도해주세요.' } },
      { status: 429, headers: { 'x-request-id': 'request-1', 'Retry-After': '900' } },
    );
  const client = new ApiClient(fetchImplementation as typeof fetch);

  await assert.rejects(
    client.request('/auth/login', { method: 'POST', auth: 'none', body: '{}' }),
    (error) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.status, 429);
      assert.equal(error.code, 'LOGIN_RATE_LIMITED');
      assert.equal(error.requestId, 'request-1');
      assert.equal(error.retryAfter, '900');
      return true;
    },
  );
});

test('logout invalidates a refresh result that is still in flight', async () => {
  let releaseRefresh: (() => void) | undefined;
  const refreshReady = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  const fetchImplementation = async (input: string | URL | Request) => {
    const path = String(input);
    if (path.endsWith('/auth/refresh')) {
      await refreshReady;
      return jsonResponse({ data: { accessToken: 'stale-token', accessTokenExpiresIn: 900 } });
    }
    if (path.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    return jsonResponse({ data: 'unexpected' });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch);
  const protectedRequest = client.request('/protected');

  await client.logout();
  releaseRefresh?.();

  await assert.rejects(protectedRequest, (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.code, 'AUTH_SESSION_CHANGED');
    return true;
  });
});

test('protected requests cannot start refresh after logout begins', async () => {
  let refreshRequests = 0;
  const fetchImplementation = async (input: string | URL | Request) => {
    const path = String(input);
    if (path.endsWith('/auth/refresh')) refreshRequests += 1;
    if (path.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    return jsonResponse({ data: 'unexpected' });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch);

  await client.logout();
  await assert.rejects(client.request('/protected'), (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.code, 'AUTH_REQUIRED');
    return true;
  });
  assert.equal(refreshRequests, 0);
});

test('a queued logout blocks protected requests before an active refresh settles', async () => {
  let releaseRefresh: (() => void) | undefined;
  const refreshReady = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  const fetchImplementation = async (input: string | URL | Request) => {
    const path = String(input);
    if (path.endsWith('/auth/refresh')) {
      await refreshReady;
      return jsonResponse({ data: { accessToken: 'stale-token', accessTokenExpiresIn: 900 } });
    }
    if (path.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    return jsonResponse({ data: 'unexpected' });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch);
  const activeRefresh = client.refreshSession();
  client.clearSession();
  const logout = client.runSessionTransition(() => client.logout());

  await assert.rejects(client.request('/protected'), (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.code, 'AUTH_REQUIRED');
    return true;
  });
  releaseRefresh?.();
  await assert.rejects(activeRefresh, { code: 'AUTH_SESSION_CHANGED' });
  await logout;
});

test('a stale refresh failure does not clear a newer session', async () => {
  let failRefresh: (() => void) | undefined;
  const refreshFailure = new Promise<void>((resolve) => {
    failRefresh = resolve;
  });
  const fetchImplementation = async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/auth/refresh')) {
      await refreshFailure;
      return jsonResponse({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'invalid' } }, { status: 401 });
    }
    return jsonResponse({ data: new Headers(init?.headers).get('Authorization') });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch);
  const staleRequest = client.request('/stale');
  client.setAccessToken('new-session-token');
  failRefresh?.();

  await assert.rejects(staleRequest);
  const current = await client.request<{ data: string }>('/current');
  assert.equal(current.data, 'Bearer new-session-token');
});

test('a queued explicit login suppresses the preceding refresh failure notification', async () => {
  let failRefresh: (() => void) | undefined;
  const refreshFailure = new Promise<void>((resolve) => {
    failRefresh = resolve;
  });
  const fetchImplementation = async (input: string | URL | Request) => {
    if (String(input).endsWith('/auth/refresh')) {
      await refreshFailure;
      return jsonResponse({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'invalid' } }, { status: 401 });
    }
    return jsonResponse({ data: 'ok' });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch);
  let unauthorizedNotifications = 0;
  client.subscribeUnauthorized(() => {
    unauthorizedNotifications += 1;
  });
  const staleRequest = client.request('/stale');
  const login = client.runSessionTransition(async () => {
    client.setAccessToken('new-login-token');
    return 'logged-in';
  });
  failRefresh?.();

  await assert.rejects(staleRequest);
  assert.equal(await login, 'logged-in');
  assert.equal(unauthorizedNotifications, 0);
});

test('logout invalidates an authentication response before it can install a token', async () => {
  const client = new ApiClient((async () => new Response(null, { status: 204 })) as typeof fetch);
  const authenticationGeneration = client.beginAuthentication();
  await client.logout();

  assert.throws(
    () => client.setAccessToken('late-login-token', authenticationGeneration),
    (error) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.code, 'AUTH_SESSION_CHANGED');
      return true;
    },
  );
  await assert.rejects(client.request('/protected'), { code: 'AUTH_REQUIRED' });
});

test('failed session initialization can clear only the session it created', async () => {
  let authorization: string | null = null;
  const fetchImplementation = async (_input: string | URL | Request, init?: RequestInit) => {
    authorization = new Headers(init?.headers).get('Authorization');
    return jsonResponse({ data: 'ok' });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch);
  const firstAttempt = client.beginAuthentication();
  const firstSession = client.setAccessToken('first-token', firstAttempt);
  const secondAttempt = client.beginAuthentication();
  client.setAccessToken('second-token', secondAttempt);

  await client.logout(firstSession);
  await client.request('/protected');
  assert.equal(authorization, 'Bearer second-token');
});

test('a delayed old-token 401 reuses the token from an earlier refresh', async () => {
  let refreshRequests = 0;
  let releaseDelayed: (() => void) | undefined;
  const delayed = new Promise<void>((resolve) => {
    releaseDelayed = resolve;
  });
  const fetchImplementation = async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    const authorization = new Headers(init?.headers).get('Authorization');
    if (path.endsWith('/auth/refresh')) {
      refreshRequests += 1;
      return jsonResponse({ data: { accessToken: 'new-token', accessTokenExpiresIn: 900 } });
    }
    if (path.endsWith('/delayed') && authorization === 'Bearer old-token') {
      await delayed;
      return jsonResponse({ error: { code: 'INVALID_ACCESS_TOKEN', message: 'expired' } }, { status: 401 });
    }
    if (authorization === 'Bearer old-token') {
      return jsonResponse({ error: { code: 'INVALID_ACCESS_TOKEN', message: 'expired' } }, { status: 401 });
    }
    return jsonResponse({ data: authorization });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch);
  client.setAccessToken('old-token');

  const delayedRequest = client.request<{ data: string }>('/delayed');
  const firstRequest = await client.request<{ data: string }>('/first');
  releaseDelayed?.();
  const secondRequest = await delayedRequest;

  assert.equal(firstRequest.data, 'Bearer new-token');
  assert.equal(secondRequest.data, 'Bearer new-token');
  assert.equal(refreshRequests, 1);
});

test('a protected response from an invalidated session is discarded', async () => {
  let releaseResponse: (() => void) | undefined;
  const responseReady = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const fetchImplementation = async () => {
    await responseReady;
    return jsonResponse({ data: 'old-account-data' });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch);
  client.setAccessToken('old-token');
  const oldRequest = client.request('/protected');
  client.setAccessToken('new-token');
  releaseResponse?.();

  await assert.rejects(oldRequest, (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.code, 'AUTH_SESSION_CHANGED');
    return true;
  });
});

test('a protected error from an invalidated session is discarded', async () => {
  let releaseResponse: (() => void) | undefined;
  const responseReady = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const fetchImplementation = async () => {
    await responseReady;
    return jsonResponse({ error: { code: 'ACCOUNT_SPECIFIC_CONFLICT', message: 'old account error' } }, { status: 409 });
  };
  const client = new ApiClient(fetchImplementation as typeof fetch);
  client.setAccessToken('old-token');
  const oldRequest = client.request('/protected');
  client.setAccessToken('new-token');
  releaseResponse?.();

  await assert.rejects(oldRequest, (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.code, 'AUTH_SESSION_CHANGED');
    return true;
  });
});

test('204 responses do not require a JSON body', async () => {
  const client = new ApiClient((async () => new Response(null, { status: 204 })) as typeof fetch);
  await assert.doesNotReject(client.request('/auth/logout', { method: 'POST', auth: 'none' }));
});
