import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRecordShareRouteGuard,
  deliverRecordShare,
  getRecordShareCreationState,
  getRecordShareSessionStorage,
  getOrCreateRecordShare,
  isShareNotFoundError,
  mergeRecordShareListSnapshot,
  readCachedRecordShare,
  reconcileCachedRecordShare,
  removeCachedRecordShare,
  settleRecordShareCreation,
  writeCachedRecordShare,
} from '../../src/features/record/record-share-orchestrator';
import type { ApiCreatedShare } from '../../src/app/api/record-api';

const share: ApiCreatedShare = {
  id: 'share-1',
  token: 'secret-token',
  apiPath: '/api/v1/shares/secret-token',
  publicUrl: 'https://topjug.example/shares/secret-token',
  status: 'active',
  mediaAssetId: null,
  expiresAt: '2026-09-01T00:00:00.000Z',
  revokedAt: null,
  createdAt: '2026-08-24T00:00:00.000Z',
};

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    values,
  };
}

test('session cache accepts a valid active share only for its record', () => {
  const storage = createStorage();
  writeCachedRecordShare(storage, 'record-1', share);

  assert.deepEqual(readCachedRecordShare(storage, 'record-1', Date.parse('2026-08-25T00:00:00Z')), share);
  assert.equal(readCachedRecordShare(storage, 'record-2', Date.parse('2026-08-25T00:00:00Z')), null);
});

test('session cache removes malformed and expired credentials', () => {
  const storage = createStorage();
  storage.setItem('topjug:record-share:record-1', '{bad json');
  assert.equal(readCachedRecordShare(storage, 'record-1'), null);
  assert.equal(storage.values.size, 0);

  storage.setItem('topjug:record-share:record-1', JSON.stringify({ version: 1, recordId: 'record-2', share }));
  assert.equal(readCachedRecordShare(storage, 'record-1'), null);
  assert.equal(storage.values.size, 0);

  writeCachedRecordShare(storage, 'record-1', share);
  assert.equal(readCachedRecordShare(storage, 'record-1', Date.parse('2026-09-02T00:00:00Z')), null);
  assert.equal(storage.values.size, 0);
});

test('unavailable session storage does not change share lifecycle results', () => {
  const unavailableStorage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };

  assert.equal(readCachedRecordShare(unavailableStorage, 'record-1'), null);
  assert.equal(writeCachedRecordShare(unavailableStorage, 'record-1', share), false);
  assert.doesNotThrow(() => removeCachedRecordShare(unavailableStorage, 'record-1'));
});

test('a throwing global sessionStorage getter is safely unavailable', () => {
  const source = Object.defineProperty({}, 'sessionStorage', {
    get() { throw new DOMException('blocked', 'SecurityError'); },
  });

  assert.equal(getRecordShareSessionStorage(source), null);
});

test('share list reconciliation retains only a matching active cached share', () => {
  const summary = {
    id: share.id,
    status: share.status,
    mediaAssetId: share.mediaAssetId,
    expiresAt: share.expiresAt,
    revokedAt: share.revokedAt,
    createdAt: share.createdAt,
  };
  assert.equal(reconcileCachedRecordShare(share, [summary]), share);
  assert.equal(reconcileCachedRecordShare(share, [{ ...summary, status: 'revoked' }]), null);
  assert.equal(reconcileCachedRecordShare(share, []), null);
});

test('route generations abort and reject results from an older record', () => {
  const guard = createRecordShareRouteGuard();
  const first = guard.begin('record-1');
  const second = guard.begin('record-2');

  assert.equal(first.signal.aborted, true);
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
  assert.equal(guard.current('record-1'), null);
  assert.equal(guard.current('record-2')?.generation, second.generation);

  guard.cancel(second);
  assert.equal(second.signal.aborted, true);
});

test('creation settles after a route change and caches under the originating record only', async () => {
  const storage = createStorage();
  const guard = createRecordShareRouteGuard();
  const origin = guard.begin('record-1');
  let resolveCreate: ((value: ApiCreatedShare) => void) | undefined;
  const create = new Promise<ApiCreatedShare>((resolve) => { resolveCreate = resolve; });
  const settling = settleRecordShareCreation(
    'record-1',
    () => create,
    () => guard.isCurrent(origin),
    () => storage,
  );

  guard.begin('record-2');
  resolveCreate?.(share);
  const result = await settling;

  assert.equal(result.isOriginCurrent, false);
  assert.deepEqual(readCachedRecordShare(storage, 'record-1', Date.parse('2026-08-25T00:00:00Z')), share);
  assert.equal(readCachedRecordShare(storage, 'record-2', Date.parse('2026-08-25T00:00:00Z')), null);
});

test('tokenless active summaries require explicit additional-link confirmation', () => {
  const activeSummary = {
    id: share.id,
    status: share.status,
    mediaAssetId: share.mediaAssetId,
    expiresAt: share.expiresAt,
    revokedAt: share.revokedAt,
    createdAt: share.createdAt,
  };

  assert.equal(getRecordShareCreationState(null, [], false), 'create');
  assert.equal(getRecordShareCreationState(null, [activeSummary], false), 'tokenless-active');
  assert.equal(getRecordShareCreationState(null, [activeSummary], true), 'confirm-additional');
  assert.equal(getRecordShareCreationState(share, [activeSummary], false), 'managed');
});

test('a stale list snapshot preserves same-route create and revoke mutations', () => {
  const created = { ...share, id: 'new-share' };
  const revoked = { ...share, status: 'revoked' as const };
  const staleIncoming = [
    { ...share, status: 'active' as const },
    { ...share, id: 'older-share', status: 'active' as const },
  ];
  const merged = mergeRecordShareListSnapshot([created, revoked], staleIncoming, 0, 2);

  assert.deepEqual(merged.map(({ id, status }) => ({ id, status })), [
    { id: 'new-share', status: 'active' },
    { id: 'share-1', status: 'revoked' },
    { id: 'older-share', status: 'active' },
  ]);
  assert.equal(mergeRecordShareListSnapshot([], staleIncoming, 2, 2), staleIncoming);
});

test('native cancellation is reported without revoking the managed share', async () => {
  const result = await deliverRecordShare(async () => {
    throw new DOMException('cancelled', 'AbortError');
  });
  assert.deepEqual(result, { outcome: 'cancelled' });
});

test('SHARE_NOT_FOUND is safely classified for cache reconciliation', () => {
  assert.equal(isShareNotFoundError({ code: 'SHARE_NOT_FOUND' }), true);
  assert.equal(isShareNotFoundError({ code: 'OTHER' }), false);

  const storage = createStorage();
  writeCachedRecordShare(storage, 'record-1', share);
  removeCachedRecordShare(storage, 'record-1');
  assert.equal(readCachedRecordShare(storage, 'record-1'), null);
});

test('a retained share is reused without duplicate creation', async () => {
  let createCalls = 0;
  const reused = await getOrCreateRecordShare(share, async () => {
    createCalls += 1;
    return { ...share, id: 'share-2' };
  });
  const created = await getOrCreateRecordShare(null, async () => {
    createCalls += 1;
    return { ...share, id: 'share-2' };
  });

  assert.deepEqual(reused, { share, created: false });
  assert.equal(created.share.id, 'share-2');
  assert.equal(created.created, true);
  assert.equal(createCalls, 1);
});
