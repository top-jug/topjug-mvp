import { ApiClientError } from './error';
import { runWithAuthSessionLock, type SessionLockManager } from './session-lock';
import type { ApiErrorResponse, ApiRequestOptions } from './types';

type Fetch = typeof globalThis.fetch;
type UnauthorizedListener = () => void;

type TokenResponse = {
  data: {
    accessToken: string;
    accessTokenExpiresIn: number;
  };
};

const API_BASE_URL = '/api/v1';

function isErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const error = value.error;
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      'message' in error &&
      typeof error.message === 'string',
  );
}

function requestPath(path: string) {
  if (!path.startsWith('/')) throw new Error('API paths must start with /.');
  return `${API_BASE_URL}${path}`;
}

export class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private sessionGeneration = 0;
  private refreshBlocked = false;
  private sessionTransition: Promise<void> = Promise.resolve();
  private pendingSessionTransitions = 0;
  private readonly unauthorizedListeners = new Set<UnauthorizedListener>();

  constructor(
    private readonly fetchImplementation: Fetch = (...args) => globalThis.fetch(...args),
    private readonly createRequestId: () => string = () => crypto.randomUUID(),
    private readonly sessionLockManager?: SessionLockManager,
  ) {}

  subscribeUnauthorized(listener: UnauthorizedListener) {
    this.unauthorizedListeners.add(listener);
    return () => this.unauthorizedListeners.delete(listener);
  }

  beginAuthentication() {
    this.clearSession();
    return this.sessionGeneration;
  }

  beginSessionRestoration() {
    this.sessionGeneration += 1;
    this.accessToken = null;
    this.refreshBlocked = false;
  }

  setAccessToken(accessToken: string, expectedGeneration?: number) {
    if (expectedGeneration !== undefined && expectedGeneration !== this.sessionGeneration) {
      throw new ApiClientError('인증 상태가 변경되었습니다.', 401, 'AUTH_SESSION_CHANGED');
    }
    this.sessionGeneration += 1;
    this.accessToken = accessToken;
    this.refreshBlocked = false;
    return this.sessionGeneration;
  }

  clearSession() {
    this.sessionGeneration += 1;
    this.accessToken = null;
    this.refreshBlocked = true;
  }

  runSessionTransition<T>(operation: () => Promise<T>) {
    this.pendingSessionTransitions += 1;
    const run = this.sessionTransition.then(async () => {
      if (this.refreshPromise) {
        try {
          await this.refreshPromise;
        } catch {
          // The explicit session transition decides the next auth state.
        }
      }
      return operation();
    });
    const result = run.finally(() => {
      this.pendingSessionTransitions -= 1;
    });
    this.sessionTransition = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async refreshSession() {
    return this.refreshAccessToken();
  }

  async logout(expectedGeneration?: number) {
    if (expectedGeneration !== undefined && expectedGeneration !== this.sessionGeneration) return;
    this.clearSession();
    await this.clearRefreshSession();
  }

  async clearRefreshSession() {
    await this.send<void>('/auth/logout', { method: 'POST', auth: 'none' }, null);
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const auth = options.auth ?? 'required';
    let token = auth === 'none' ? null : this.accessToken;
    const requestGeneration = this.sessionGeneration;

    if (auth === 'required' && !token) {
      if (this.refreshBlocked) throw new ApiClientError('로그인이 필요합니다.', 401, 'AUTH_REQUIRED');
      token = await this.refreshAccessToken();
    }

    try {
      const response = await this.send<T>(path, options, token);
      this.assertCurrentSession(auth, token, requestGeneration);
      return response;
    } catch (error) {
      this.assertCurrentSession(auth, token, requestGeneration);
      if (!(error instanceof ApiClientError) || error.status !== 401 || auth !== 'required') throw error;
      if (token && this.accessToken && token !== this.accessToken) {
        const replacementToken = this.accessToken;
        const response = await this.send<T>(path, options, replacementToken);
        this.assertCurrentSession(auth, replacementToken, requestGeneration);
        return response;
      }
      token = await this.refreshAccessToken();
      const response = await this.send<T>(path, options, token);
      this.assertCurrentSession(auth, token, requestGeneration);
      return response;
    }
  }

  async requestCurrentSession<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const token = this.accessToken;
    const generation = this.sessionGeneration;
    if (!token) throw new ApiClientError('로그인이 필요합니다.', 401, 'AUTH_REQUIRED');
    try {
      const response = await this.send<T>(path, options, token);
      this.assertCurrentSession('required', token, generation);
      return response;
    } catch (error) {
      this.assertCurrentSession('required', token, generation);
      throw error;
    }
  }

  private async refreshAccessToken() {
    if (this.refreshPromise) return this.refreshPromise;
    if (this.refreshBlocked) throw new ApiClientError('로그인이 필요합니다.', 401, 'AUTH_REQUIRED');

    const generation = this.sessionGeneration;
    this.refreshPromise = runWithAuthSessionLock(
      () => this.send<TokenResponse>('/auth/refresh', { method: 'POST', auth: 'none' }, null),
      this.sessionLockManager,
    )
      .then((response) => {
        if (generation !== this.sessionGeneration) {
          throw new ApiClientError('인증 상태가 변경되었습니다.', 401, 'AUTH_SESSION_CHANGED');
        }
        this.accessToken = response.data.accessToken;
        return response.data.accessToken;
      })
      .catch((error: unknown) => {
        if (
          generation === this.sessionGeneration &&
          error instanceof ApiClientError &&
          error.status === 401 &&
          error.code !== 'AUTH_SESSION_CHANGED'
        ) {
          this.accessToken = null;
          this.refreshBlocked = true;
          if (this.pendingSessionTransitions === 0) {
            for (const listener of this.unauthorizedListeners) listener();
          }
        }
        throw error;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private assertCurrentSession(auth: ApiRequestOptions['auth'], accessToken: string | null, generation: number) {
    if ((auth === 'required' || (auth === 'optional' && accessToken)) && generation !== this.sessionGeneration) {
      throw new ApiClientError('인증 상태가 변경되었습니다.', 401, 'AUTH_SESSION_CHANGED');
    }
  }

  private async send<T>(path: string, options: ApiRequestOptions, accessToken: string | null): Promise<T> {
    const { auth: _auth, headers: inputHeaders, ...requestOptions } = options;
    const headers = new Headers(inputHeaders);
    headers.set('Accept', 'application/json');
    headers.set('x-request-id', this.createRequestId());
    if (requestOptions.body && !(requestOptions.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    let response: Response;
    try {
      const fetchImplementation = this.fetchImplementation;
      response = await fetchImplementation(requestPath(path), {
        ...requestOptions,
        credentials: 'include',
        headers,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
      throw new ApiClientError('서버에 연결할 수 없습니다.', 0, 'NETWORK_ERROR', null, null, { cause });
    }

    const requestId = response.headers.get('x-request-id');
    const retryAfter = response.headers.get('Retry-After');
    if (response.status === 204) return undefined as T;

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new ApiClientError('서버 응답을 확인할 수 없습니다.', response.status, 'INVALID_RESPONSE', requestId, retryAfter, { cause });
    }

    if (!response.ok) {
      if (isErrorResponse(body)) {
        throw new ApiClientError(body.error.message, response.status, body.error.code, requestId, retryAfter);
      }
      throw new ApiClientError('요청을 처리하지 못했습니다.', response.status, 'UNKNOWN_API_ERROR', requestId, retryAfter);
    }

    return body as T;
  }
}

export const apiClient = new ApiClient();

export function apiRequest<T>(path: string, options?: ApiRequestOptions) {
  return apiClient.request<T>(path, options);
}
