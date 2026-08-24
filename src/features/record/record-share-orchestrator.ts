import type { ApiCreatedShare, ApiShareSummary } from '../../app/api/record-api';

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'topjug:record-share:';
const inFlightCreations = new Map<string, Promise<ApiCreatedShare>>();

interface ShareStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type RecordShareCreationState = 'managed' | 'create' | 'tokenless-active' | 'unknown' | 'confirm-additional';

export interface RecordShareRouteScope {
  recordId: string;
  generation: number;
  signal: AbortSignal;
}

export function createRecordShareRouteGuard() {
  let active: (RecordShareRouteScope & { controller: AbortController }) | null = null;
  let generation = 0;

  return {
    begin(recordId: string) {
      active?.controller.abort();
      const controller = new AbortController();
      active = { recordId, generation: ++generation, signal: controller.signal, controller };
      return active;
    },
    current(recordId: string) {
      return active?.recordId === recordId && !active.signal.aborted ? active : null;
    },
    isCurrent(scope: Pick<RecordShareRouteScope, 'recordId' | 'generation'>) {
      return active?.recordId === scope.recordId
        && active.generation === scope.generation
        && !active.signal.aborted;
    },
    cancel(scope: Pick<RecordShareRouteScope, 'generation'>) {
      if (active?.generation !== scope.generation) return;
      active.controller.abort();
      active = null;
    },
  };
}

export function readCachedRecordShare(storage: ShareStorage, recordId: string, now = Date.now()) {
  const key = recordShareCacheKey(recordId);

  try {
    const parsed = JSON.parse(storage.getItem(key) ?? 'null');
    if (!isCachedRecordShare(parsed, recordId, now)) {
      safelyRemove(storage, key);
      return null;
    }
    return parsed.share;
  } catch {
    safelyRemove(storage, key);
    return null;
  }
}

export function getRecordShareSessionStorage(source: unknown = globalThis): ShareStorage | null {
  try {
    if (!isObject(source) || !('sessionStorage' in source)) return null;
    const storage = source.sessionStorage;
    return isShareStorage(storage) ? storage : null;
  } catch {
    return null;
  }
}

export function writeCachedRecordShare(storage: ShareStorage, recordId: string, share: ApiCreatedShare) {
  try {
    storage.setItem(recordShareCacheKey(recordId), JSON.stringify({
      version: CACHE_VERSION,
      recordId,
      share,
    }));
    return true;
  } catch {
    return false;
  }
}

export function removeCachedRecordShare(storage: ShareStorage, recordId: string) {
  safelyRemove(storage, recordShareCacheKey(recordId));
}

export function reconcileCachedRecordShare(cached: ApiCreatedShare | null, shares: ApiShareSummary[]) {
  if (!cached) return null;
  return shares.some((share) => share.id === cached.id && share.status === 'active') ? cached : null;
}

export function reconcileRecordShareAfterRevoke(
  managedShare: ApiCreatedShare | null,
  authoritativeShares: ApiShareSummary[],
  revokedShareId: string,
) {
  const target = authoritativeShares.find((share) => share.id === revokedShareId);
  return {
    shares: authoritativeShares,
    managedShare: reconcileCachedRecordShare(managedShare, authoritativeShares),
    targetState: target?.status === 'active' ? 'active' as const : 'inactive' as const,
  };
}

export function createRecordShareRevokeGuard() {
  let sequence = 0;
  let active: {
    sequence: number;
    recordId: string;
    shareId: string;
    managedShareId: string | null;
    status: 'revoking' | 'reconciling' | 'unknown';
  } | null = null;

  return {
    begin(recordId: string, shareId: string, managedShareId: string | null) {
      if (active) return null;
      active = { sequence: ++sequence, recordId, shareId, managedShareId, status: 'revoking' };
      return active;
    },
    current() {
      return active;
    },
    isCurrent(operation: { sequence: number }) {
      return active?.sequence === operation.sequence;
    },
    canApply(operation: { sequence: number; managedShareId: string | null }, currentManagedShareId: string | null) {
      return active?.sequence === operation.sequence && operation.managedShareId === currentManagedShareId;
    },
    markReconciling(operation: { sequence: number }) {
      if (active?.sequence !== operation.sequence) return false;
      active.status = 'reconciling';
      return true;
    },
    markUnknown(operation: { sequence: number }) {
      if (active?.sequence !== operation.sequence) return false;
      active.status = 'unknown';
      return true;
    },
    finish(operation: { sequence: number }) {
      if (active?.sequence !== operation.sequence) return false;
      active = null;
      return true;
    },
    reset() {
      active = null;
    },
    isBlocked() {
      return active !== null;
    },
  };
}

export function getRecordShareCreationState(
  managedShare: ApiCreatedShare | null,
  shares: ApiShareSummary[],
  isConfirmingAdditional: boolean,
  isShareListKnown: boolean,
): RecordShareCreationState {
  if (managedShare) return 'managed';
  if (!isShareListKnown) return isConfirmingAdditional ? 'confirm-additional' : 'unknown';
  if (!shares.some((share) => share.status === 'active')) return 'create';
  return isConfirmingAdditional ? 'confirm-additional' : 'tokenless-active';
}

export function mergeRecordShareListSnapshot(
  current: ApiShareSummary[],
  incoming: ApiShareSummary[],
  requestMutationVersion: number,
  currentMutationVersion: number,
) {
  if (requestMutationVersion === currentMutationVersion) return incoming;
  const currentIds = new Set(current.map((share) => share.id));
  return [...current, ...incoming.filter((share) => !currentIds.has(share.id))];
}

export async function settleRecordShareCreation(
  recordId: string,
  createShare: () => Promise<ApiCreatedShare>,
  isOriginCurrent: () => boolean,
  getStorage: () => ShareStorage | null = () => getRecordShareSessionStorage(),
) {
  let creation = inFlightCreations.get(recordId);
  if (!creation) {
    creation = Promise.resolve()
      .then(createShare)
      .then((share) => {
        const storage = getStorage();
        if (storage) writeCachedRecordShare(storage, recordId, share);
        return share;
      });
    inFlightCreations.set(recordId, creation);
    const registeredCreation = creation;
    void creation.then(
      () => clearInFlightCreation(recordId, registeredCreation),
      () => clearInFlightCreation(recordId, registeredCreation),
    );
  }
  const share = await creation;
  return { share, isOriginCurrent: isOriginCurrent() };
}

export function getInFlightRecordShareCreation(recordId: string) {
  return inFlightCreations.get(recordId) ?? null;
}

export async function getOrCreateRecordShare<T>(existing: T | null, createShare: () => Promise<T>) {
  if (existing) return { share: existing, created: false as const };
  return { share: await createShare(), created: true as const };
}

export async function deliverRecordShare(deliver: () => Promise<void>) {
  try {
    await deliver();
    return { outcome: 'delivered' as const };
  } catch (error) {
    if (isAbortError(error)) return { outcome: 'cancelled' as const };
    return { outcome: 'failed' as const, error };
  }
}

export function isShareNotFoundError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'SHARE_NOT_FOUND';
}

function recordShareCacheKey(recordId: string) {
  return `${CACHE_PREFIX}${recordId}`;
}

function clearInFlightCreation(recordId: string, creation: Promise<ApiCreatedShare>) {
  if (inFlightCreations.get(recordId) === creation) inFlightCreations.delete(recordId);
}

function safelyRemove(storage: ShareStorage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage availability must not affect the server-side share lifecycle.
  }
}

function isCachedRecordShare(value: unknown, recordId: string, now: number): value is {
  version: 1;
  recordId: string;
  share: ApiCreatedShare;
} {
  if (!isObject(value) || value.version !== CACHE_VERSION || value.recordId !== recordId || !isObject(value.share)) return false;
  const share = value.share;
  return isNonEmptyString(share.id)
    && isNonEmptyString(share.token)
    && isNonEmptyString(share.apiPath)
    && (share.publicUrl === null || isNonEmptyString(share.publicUrl))
    && share.status === 'active'
    && (share.mediaAssetId === null || isNonEmptyString(share.mediaAssetId))
    && (share.expiresAt === null || (isNonEmptyString(share.expiresAt) && Date.parse(share.expiresAt) > now))
    && share.revokedAt === null
    && isNonEmptyString(share.createdAt);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isShareStorage(value: unknown): value is ShareStorage {
  return isObject(value)
    && typeof value.getItem === 'function'
    && typeof value.setItem === 'function'
    && typeof value.removeItem === 'function';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
