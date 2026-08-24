import assert from 'node:assert/strict';
import test from 'node:test';
import { runRecordShareAttempt } from '../../src/features/record/record-share-orchestrator';

test('creates and presents a share', async () => {
  const calls: string[] = [];
  const result = await runRecordShareAttempt({
    createShare: async () => {
      calls.push('create');
      return { id: 'new-share' };
    },
    presentShare: async (share) => { calls.push(`share:${share.id}`); },
    revokeShare: async () => { calls.push('revoke'); },
  });

  assert.deepEqual(calls, ['create', 'share:new-share']);
  assert.deepEqual(result, { outcome: 'shared', share: { id: 'new-share' }, createdForAttempt: true });
});

test('returns a create failure without trying to present or revoke', async () => {
  const createError = new Error('create failed');
  let followupCalls = 0;
  const result = await runRecordShareAttempt({
    createShare: async () => { throw createError; },
    presentShare: async () => { followupCalls += 1; },
    revokeShare: async () => { followupCalls += 1; },
  });

  assert.equal(followupCalls, 0);
  assert.deepEqual(result, { outcome: 'failed', error: createError, createdForAttempt: true });
});

test('revokes a newly created share when native sharing is cancelled with AbortError', async () => {
  const calls: string[] = [];
  const result = await runRecordShareAttempt({
    createShare: async () => ({ id: 'new-share' }),
    presentShare: async () => { throw new DOMException('cancelled', 'AbortError'); },
    revokeShare: async (share) => { calls.push(share.id); },
  });

  assert.deepEqual(calls, ['new-share']);
  assert.deepEqual(result, { outcome: 'cancelled-revoked', share: { id: 'new-share' }, createdForAttempt: true });
});

test('discloses a newly created active share when cancellation cleanup fails', async () => {
  const revokeError = new Error('revoke failed');
  const result = await runRecordShareAttempt({
    createShare: async () => ({ id: 'new-share' }),
    presentShare: async () => { throw new DOMException('cancelled', 'AbortError'); },
    revokeShare: async () => { throw revokeError; },
  });

  assert.deepEqual(result, {
    outcome: 'cancelled-active',
    share: { id: 'new-share' },
    createdForAttempt: true,
    revokeError,
  });
});

test('does not revoke a pre-existing share selected for a cancelled attempt', async () => {
  let revokeCalls = 0;
  const existingShare = { id: 'existing-share' };
  const result = await runRecordShareAttempt({
    existingShare,
    createShare: async () => { throw new Error('must not create'); },
    presentShare: async () => { throw new DOMException('cancelled', 'AbortError'); },
    revokeShare: async () => { revokeCalls += 1; },
  });

  assert.equal(revokeCalls, 0);
  assert.deepEqual(result, { outcome: 'cancelled', share: existingShare, createdForAttempt: false });
});

test('returns a presentation failure with the created share still active', async () => {
  const shareError = new Error('share failed');
  const result = await runRecordShareAttempt({
    createShare: async () => ({ id: 'new-share' }),
    presentShare: async () => { throw shareError; },
    revokeShare: async () => undefined,
  });

  assert.deepEqual(result, {
    outcome: 'failed',
    error: shareError,
    share: { id: 'new-share' },
    createdForAttempt: true,
  });
});
