import type { AuthStatus, UserRole } from '../auth/types';

export type OperationsAccessDecision = 'loading' | 'auth-error' | 'login' | 'forbidden' | 'verify';

export function operationsAccessDecision(status: AuthStatus, role: UserRole | null): OperationsAccessDecision {
  if (status === 'loading') return 'loading';
  if (status === 'error') return 'auth-error';
  if (status === 'unauthenticated') return 'login';
  if (role !== 'operations_admin') return 'forbidden';
  return 'verify';
}
