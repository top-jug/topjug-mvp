export const AUTH_SESSION_EVENT_KEY = 'topjug.auth-session-event';

type StorageWriter = Pick<Storage, 'setItem'>;
type SessionEvent = Pick<StorageEvent, 'key' | 'newValue'>;

export function publishAuthenticatedSession(
  storage?: StorageWriter,
  nonce?: string,
) {
  try {
    const eventNonce = nonce ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    (storage ?? window.localStorage).setItem(AUTH_SESSION_EVENT_KEY, JSON.stringify({ type: 'authenticated', nonce: eventNonce }));
  } catch {
    // The current tab remains authenticated when browser storage is unavailable.
  }
}

export function isAuthenticatedSessionEvent(event: SessionEvent) {
  if (event.key !== AUTH_SESSION_EVENT_KEY || !event.newValue) return false;
  try {
    const value: unknown = JSON.parse(event.newValue);
    return Boolean(
      value &&
        typeof value === 'object' &&
        'type' in value &&
        value.type === 'authenticated' &&
        'nonce' in value &&
        typeof value.nonce === 'string',
    );
  } catch {
    return false;
  }
}

export function createSessionReconciler(reconcile: () => Promise<void>, canReconcile: () => boolean = () => true) {
  let dirty = false;
  let active: Promise<void> | null = null;

  return {
    markDirty() {
      dirty = true;
    },
    markClean() {
      dirty = false;
    },
    isDirty() {
      return dirty;
    },
    reconcileOnActivation() {
      if (active || !canReconcile()) return active ?? Promise.resolve();
      dirty = false;
      active = Promise.resolve()
        .then(reconcile)
        .finally(() => {
          active = null;
        });
      return active;
    },
  };
}
