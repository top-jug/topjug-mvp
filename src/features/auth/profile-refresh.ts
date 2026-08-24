import { ApiClientError } from '../../lib/api/error';
import type { AuthUser } from './types';

export type ProfileRefreshState = 'loading' | 'stale' | 'error' | 'ready';

export function getProfileRefreshState(isRefreshing: boolean, error: ApiClientError | null, hasUser: boolean): ProfileRefreshState {
  if (isRefreshing) return 'loading';
  if (error) return hasUser ? 'stale' : 'error';
  return 'ready';
}

export function profileRefreshFailure(user: AuthUser | null, error: ApiClientError) {
  if (error.status === 401) {
    return { user: null, status: 'unauthenticated' as const, error: null };
  }
  return { user, status: user ? 'authenticated' as const : 'error' as const, error };
}
