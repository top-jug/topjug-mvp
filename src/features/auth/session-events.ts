export const AUTH_SESSION_EVENT_KEY = 'topjug.auth-session-event';

type StorageWriter = Pick<Storage, 'setItem'>;
type SessionEvent = Pick<StorageEvent, 'key' | 'newValue'>;

function publishSessionState(
  type: 'authenticated' | 'logged-out',
  storage?: StorageWriter,
  nonce?: string,
) {
  try {
    const eventNonce = nonce ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const value = JSON.stringify({ type, nonce: eventNonce });
    (storage ?? window.localStorage).setItem(AUTH_SESSION_EVENT_KEY, value);
    return value;
  } catch {
    // The current tab remains authenticated when browser storage is unavailable.
    return null;
  }
}

export function publishAuthenticatedSession(storage?: StorageWriter, nonce?: string) {
  return publishSessionState('authenticated', storage, nonce);
}

export function publishLoggedOutSession(storage?: StorageWriter, nonce?: string) {
  return publishSessionState('logged-out', storage, nonce);
}

export function readSessionStateEvent(storage?: Pick<Storage, 'getItem'>) {
  try {
    return (storage ?? window.localStorage).getItem(AUTH_SESSION_EVENT_KEY);
  } catch {
    return null;
  }
}

export function isSessionStateEvent(event: SessionEvent) {
  if (event.key !== AUTH_SESSION_EVENT_KEY || !event.newValue) return false;
  try {
    const value: unknown = JSON.parse(event.newValue);
    return Boolean(
      value &&
        typeof value === 'object' &&
        'type' in value &&
        (value.type === 'authenticated' || value.type === 'logged-out') &&
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
  let followUp = false;

  const run = (bootstrap: boolean) => {
    if (active || !canReconcile() || (!bootstrap && !dirty)) return active ?? Promise.resolve();
    dirty = false;
    followUp = false;
    active = Promise.resolve()
      .then(reconcile)
      .finally(() => {
        active = null;
        if (followUp && dirty && canReconcile()) {
          followUp = false;
          void run(false);
        }
      });
    return active;
  };

  return {
    markDirty() {
      dirty = true;
      if (active) followUp = true;
    },
    markClean() {
      dirty = false;
    },
    isDirty() {
      return dirty;
    },
    reconcileOnActivation() {
      return run(false);
    },
    reconcileBootstrap() {
      return run(true);
    },
  };
}
