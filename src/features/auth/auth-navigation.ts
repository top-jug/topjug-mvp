export function intendedPath(state: unknown) {
  if (!state || typeof state !== 'object' || !('from' in state) || typeof state.from !== 'string') return '/';
  return state.from.startsWith('/') && !state.from.startsWith('//') ? state.from : '/';
}
