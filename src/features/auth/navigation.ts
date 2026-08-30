export type AuthNavigationState = { from?: string; resetComplete?: boolean };

export function intendedPath(state: unknown) {
  if (!state || typeof state !== 'object' || !('from' in state) || typeof state.from !== 'string') return '/';
  return state.from.startsWith('/') && !state.from.startsWith('//') ? state.from : '/';
}

export function authNavigationState(state: unknown): AuthNavigationState {
  const from = intendedPath(state);
  return from === '/' ? {} : { from };
}
