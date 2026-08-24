import { apiClient, apiRequest } from '../../lib/api/client';
import { ApiClientError } from '../../lib/api/error';
import type { ApiDataResponse } from '../../lib/api/types';
import { AUTH_SESSION_TIMEOUT_MS, runWithAuthSessionLock } from '../../lib/api/session-lock';
import type { AuthUser, LoginInput, RegisterInput } from './types';

export const LOGOUT_PENDING_KEY = 'topjug.logout-pending';

type AuthResponse = ApiDataResponse<{
  user: Pick<AuthUser, 'id' | 'email' | 'displayName' | 'homeRegionCode' | 'emailVerifiedAt' | 'createdAt'>;
  accessToken: string;
  accessTokenExpiresIn: number;
}>;

function hasPendingLogout() {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(LOGOUT_PENDING_KEY) === 'true';
  } catch {
    return false;
  }
}

function markLogoutPending() {
  try {
    window.localStorage.setItem(LOGOUT_PENDING_KEY, 'true');
  } catch {
    // In-memory logout still proceeds when storage is unavailable.
  }
}

function clearLogoutPending() {
  try {
    window.localStorage.removeItem(LOGOUT_PENDING_KEY);
  } catch {
    // The server session has already been invalidated.
  }
}

async function clearRefreshSession(signal?: AbortSignal) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    signal?.throwIfAborted();
    try {
      await apiClient.clearRefreshSession(signal);
      return;
    } catch (error) {
      lastError = error;
      signal?.throwIfAborted();
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastError;
}

function runSharedSessionTransition<T>(operation: (signal: AbortSignal) => Promise<T>) {
  return runWithAuthSessionLock((signal) => apiClient.runSessionTransition(() => operation(signal)));
}

async function establishSession(path: '/auth/login' | '/auth/register', input: LoginInput | RegisterInput) {
  const authenticationGeneration = apiClient.beginAuthentication();
  return runSharedSessionTransition(async (signal) => {
    let sessionGeneration: number | undefined;
    try {
      const response = await apiRequest<AuthResponse>(path, {
        method: 'POST',
        auth: 'none',
        signal,
        body: JSON.stringify(input),
      });
      sessionGeneration = apiClient.setAccessToken(response.data.accessToken, authenticationGeneration);
      const user = await getCurrentUser(true, signal);
      clearLogoutPending();
      return user;
    } catch (error) {
      try {
        if (sessionGeneration === undefined) await apiClient.clearRefreshSession(signal);
        else await apiClient.logout(sessionGeneration, signal);
      } catch {
        // Preserve the original session initialization error.
      }
      throw error;
    }
  });
}

export function login(input: LoginInput) {
  return establishSession('/auth/login', input);
}

export function register(input: RegisterInput) {
  return establishSession('/auth/register', input);
}

export async function restoreSession() {
  if (hasPendingLogout()) {
    return runSharedSessionTransition(async (signal) => {
      apiClient.clearSession();
      await clearRefreshSession(signal);
      clearLogoutPending();
      throw new ApiClientError('로그인이 필요합니다.', 401, 'AUTH_REQUIRED');
    });
  }
  return apiClient.runSessionTransition(async () => {
    const signal = AbortSignal.timeout(AUTH_SESSION_TIMEOUT_MS);
    await apiClient.refreshSession(signal);
    return getCurrentUser(false, signal);
  });
}

export async function getCurrentUser(useCurrentSession = false, signal?: AbortSignal) {
  const response = useCurrentSession
    ? await apiClient.requestCurrentSession<ApiDataResponse<AuthUser>>('/me', { signal })
    : await apiRequest<ApiDataResponse<AuthUser>>('/me', { signal });
  return response.data;
}

export function logout() {
  apiClient.clearSession();
  return runSharedSessionTransition(async (signal) => {
    markLogoutPending();
    await clearRefreshSession(signal);
    clearLogoutPending();
  });
}
