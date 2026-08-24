const AUTH_SESSION_LOCK = 'topjug.auth-session';
export const AUTH_SESSION_LEASE_PREFIX = `${AUTH_SESSION_LOCK}.contender.`;
export const AUTH_SESSION_TIMEOUT_MS = 15_000;

export type SessionLockManager = {
  request<T>(name: string, options: { signal: AbortSignal }, callback: () => Promise<T>): Promise<T>;
};

type LeaseStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'length' | 'key'>;

export type StorageLeaseOptions = {
  storage: LeaseStorage;
  owner: string;
  now?: () => number;
  wait?: (signal: AbortSignal) => Promise<void>;
  leaseMs?: number;
};

type LeaseRecord = {
  owner: string;
  choosing: boolean;
  ticket: number;
  expiresAt: number;
};

export class AuthSessionLockError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AuthSessionLockError';
  }
}

function parseLease(value: string | null): LeaseRecord | null {
  if (!value) return null;
  try {
    const lease: unknown = JSON.parse(value);
    if (!lease || typeof lease !== 'object') return null;
    if (!('owner' in lease) || typeof lease.owner !== 'string') return null;
    if (!('choosing' in lease) || typeof lease.choosing !== 'boolean') return null;
    if (!('ticket' in lease) || typeof lease.ticket !== 'number') return null;
    if (!('expiresAt' in lease) || typeof lease.expiresAt !== 'number') return null;
    return lease as LeaseRecord;
  } catch {
    return null;
  }
}

function contenders(storage: LeaseStorage, now: number) {
  const records: LeaseRecord[] = [];
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(AUTH_SESSION_LEASE_PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    const lease = parseLease(storage.getItem(key));
    if (lease && lease.expiresAt > now) records.push(lease);
    else storage.removeItem(key);
  }
  return records;
}

function defaultWait(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(finish, 50);
    function finish() {
      cleanup();
      resolve();
    }
    function abort() {
      cleanup();
      reject(signal.reason);
    }
    function handleStorage(event: StorageEvent) {
      if (event.key?.startsWith(AUTH_SESSION_LEASE_PREFIX)) finish();
    }
    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener('storage', handleStorage);
      signal.removeEventListener('abort', abort);
    }
    window.addEventListener('storage', handleStorage);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function acquireStorageLease(options: StorageLeaseOptions, signal: AbortSignal) {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? defaultWait;
  const leaseMs = options.leaseMs ?? AUTH_SESSION_TIMEOUT_MS + 1_000;
  const key = `${AUTH_SESSION_LEASE_PREFIX}${options.owner}`;
  const expiresAt = now() + leaseMs;
  const write = (choosing: boolean, ticket: number) => {
    options.storage.setItem(key, JSON.stringify({ owner: options.owner, choosing, ticket, expiresAt }));
  };

  try {
    signal.throwIfAborted();
    // Lamport bakery tickets avoid relying on a non-atomic localStorage get/set lease.
    write(true, 0);
    const ticket = contenders(options.storage, now()).reduce((highest, lease) => Math.max(highest, lease.ticket), 0) + 1;
    write(false, ticket);

    while (true) {
      signal.throwIfAborted();
      const ownLease = parseLease(options.storage.getItem(key));
      if (!ownLease || ownLease.owner !== options.owner || ownLease.ticket !== ticket || ownLease.expiresAt <= now()) {
        throw new AuthSessionLockError('Auth session lease ownership was lost.');
      }
      const predecessor = contenders(options.storage, now()).some(
        (lease) => lease.owner !== options.owner && (lease.choosing || lease.ticket < ticket || (lease.ticket === ticket && lease.owner < options.owner)),
      );
      if (!predecessor) break;
      await wait(signal);
    }

    return () => {
      const lease = parseLease(options.storage.getItem(key));
      if (lease?.owner === options.owner && lease.ticket === ticket) options.storage.removeItem(key);
    };
  } catch (error) {
    const lease = parseLease(options.storage.getItem(key));
    if (lease?.owner === options.owner) options.storage.removeItem(key);
    throw error;
  }
}

let processLock = Promise.resolve();

function runWithProcessLock<T>(operation: () => Promise<T>) {
  const result = processLock.then(operation);
  processLock = result.then(() => undefined, () => undefined);
  return result;
}

export async function runWithAuthSessionLock<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  lockManager?: SessionLockManager,
  storageLeaseOptions?: StorageLeaseOptions,
  timeoutMs = AUTH_SESSION_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new AuthSessionLockError('Auth session operation timed out.')), timeoutMs);
  let operationStarted = false;
  const run = () => {
    controller.signal.throwIfAborted();
    operationStarted = true;
    return Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true })),
    ]);
  };
  const manager = lockManager ?? (typeof navigator !== 'undefined' ? navigator.locks as unknown as SessionLockManager : undefined);
  let webLockStarted = false;

  try {
    if (manager) {
      try {
        return await manager.request(AUTH_SESSION_LOCK, { signal: controller.signal }, async () => {
          webLockStarted = true;
          return run();
        });
      } catch (error) {
        if (webLockStarted || controller.signal.aborted) throw error;
      }
    }

    if (typeof window === 'undefined' && !storageLeaseOptions) return await runWithProcessLock(run);
    const options = storageLeaseOptions ?? {
      storage: window.localStorage,
      owner: crypto.randomUUID(),
    };
    const release = await acquireStorageLease(options, controller.signal);
    try {
      return await run();
    } finally {
      release();
    }
  } catch (error) {
    if (operationStarted) throw error;
    if (error instanceof AuthSessionLockError) throw error;
    throw new AuthSessionLockError('Unable to safely lock the auth session.', { cause: error });
  } finally {
    clearTimeout(timer);
  }
}
