import type { UserRole } from './types';

export function authenticatedLandingPath(state: unknown, role: UserRole) {
  if (state && typeof state === 'object' && 'from' in state && typeof state.from === 'string' && state.from.startsWith('/')) {
    return state.from;
  }
  return role === 'operations_admin' ? '/ops' : '/';
}
