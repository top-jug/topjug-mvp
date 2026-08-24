const AUTH_SESSION_LOCK = 'topjug.auth-session';

export type SessionLockManager = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

export function runWithAuthSessionLock<T>(operation: () => Promise<T>, lockManager?: SessionLockManager) {
  const manager = lockManager ?? (typeof navigator !== 'undefined' ? navigator.locks : undefined);
  return manager ? manager.request(AUTH_SESSION_LOCK, operation) : operation();
}
