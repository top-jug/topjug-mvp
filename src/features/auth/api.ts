import { apiClient, apiRequest } from '../../lib/api/client';
import type { ApiDataResponse } from '../../lib/api/types';
import type { AuthUser, LoginInput, RegisterInput } from './types';

type AuthResponse = ApiDataResponse<{
  accessToken: string;
  accessTokenExpiresIn: number;
}>;

async function establishSession(path: '/auth/login' | '/auth/register', input: LoginInput | RegisterInput) {
  const authenticationGeneration = apiClient.beginAuthentication();
  return apiClient.runSessionTransition(async () => {
    let sessionGeneration: number | undefined;
    try {
      const response = await apiRequest<AuthResponse>(path, {
        method: 'POST',
        auth: 'none',
        body: JSON.stringify(input),
      });
      sessionGeneration = apiClient.setAccessToken(response.data.accessToken, authenticationGeneration);
      return await getCurrentUser();
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
  return apiClient.runSessionTransition(async () => {
    await apiClient.refreshSession();
    return getCurrentUser();
  });
}

export async function getCurrentUser() {
  const response = await apiRequest<ApiDataResponse<AuthUser>>('/me');
  return response.data;
}

export function logout() {
  apiClient.clearSession();
  return apiClient.runSessionTransition(() => apiClient.logout());
}
