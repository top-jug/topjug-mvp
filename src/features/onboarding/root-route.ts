import type { AuthStatus } from '../auth/types';

export type RootRouteView = 'loading' | 'error' | 'onboarding' | 'home';

export function getRootRouteView(status: AuthStatus): RootRouteView {
  if (status === 'authenticated') return 'home';
  if (status === 'unauthenticated') return 'onboarding';
  return status;
}
