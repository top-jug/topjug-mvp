import type { ApiCreatedShare, ApiShareSummary } from '../../app/api/record-api';

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'topjug:record-share:';

interface ShareStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
