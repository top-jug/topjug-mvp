import type { AuthStatus, UserRole } from './types';

type RouteLocation = {
  pathname: string;
  search: string;
  hash: string;
};

export function intendedPath(state: unknown) {
  if (!state || typeof state !== 'object' || !('from' in state) || typeof state.from !== 'string') return '/';
  return state.from.startsWith('/') && !state.from.startsWith('//') ? state.from : '/';
}

export function authenticatedLandingPath(state: unknown, role: UserRole) {
  if (state && typeof state === 'object' && 'from' in state && typeof state.from === 'string') {
    return intendedPath(state);
  }
  return role === 'operations_admin' ? '/ops' : '/';
}

export function protectedDestination(location: RouteLocation) {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function loginRedirectState(location: RouteLocation) {
  return { from: protectedDestination(location) };
}

export function shouldLoadProtectedResources(status: AuthStatus) {
  return status === 'authenticated';
}
