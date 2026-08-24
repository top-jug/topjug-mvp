import { apiClient, apiRequest } from '../../lib/api/client';
import { ApiClientError } from '../../lib/api/error';
import type { ApiDataResponse } from '../../lib/api/types';
import { runWithAuthSessionLock } from '../../lib/api/session-lock';
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

async function clearRefreshSession() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await apiClient.clearRefreshSession();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastError;
}

function runSharedSessionTransition<T>(operation: () => Promise<T>) {
  return runWithAuthSessionLock(() => apiClient.runSessionTransition(operation));
}

async function establishSession(path: '/auth/login' | '/auth/register', input: LoginInput | RegisterInput) {
  const authenticationGeneration = apiClient.beginAuthentication();
  return runSharedSessionTransition(async () => {
    let sessionGeneration: number | undefined;
    try {
      const response = await apiRequest<AuthResponse>(path, {
        method: 'POST',
        auth: 'none',
        body: JSON.stringify(input),
      });
      sessionGeneration = apiClient.setAccessToken(response.data.accessToken, authenticationGeneration);
      const user = await getCurrentUser(true);
      clearLogoutPending();
      return user;
    } catch (error) {
      try {
        if (sessionGeneration === undefined) await apiClient.clearRefreshSession();
        else await apiClient.logout(sessionGeneration);
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
    return runSharedSessionTransition(async () => {
      apiClient.clearSession();
      await clearRefreshSession();
      clearLogoutPending();
      throw new ApiClientError('로그인이 필요합니다.', 401, 'AUTH_REQUIRED');
    });
  }
  return apiClient.runSessionTransition(async () => {
    await apiClient.refreshSession();
    return getCurrentUser();
  });
}

export async function getCurrentUser(useCurrentSession = false) {
  const response = useCurrentSession
    ? await apiClient.requestCurrentSession<ApiDataResponse<AuthUser>>('/me')
    : await apiRequest<ApiDataResponse<AuthUser>>('/me');
  return response.data;
}

export function logout() {
  apiClient.clearSession();
  return runSharedSessionTransition(async () => {
    markLogoutPending();
    await clearRefreshSession();
    clearLogoutPending();
  });
}
