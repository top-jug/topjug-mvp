import assert from 'node:assert/strict';
import test from 'node:test';
import { createPendingGuard } from '../../src/features/membership/pending-guard';

test('pending guard runs only one action until the active request settles', async () => {
  const guard = createPendingGuard();
  let calls = 0;
  let resolveRequest: (() => void) | undefined;
  const request = () => {
    calls += 1;
    return new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
  };

  const first = guard.run(request);
  const duplicate = guard.run(request);

  assert.equal(guard.isPending(), true);
  assert.equal(calls, 1);
  assert.equal(await duplicate, undefined);

  resolveRequest?.();
  await first;
  assert.equal(guard.isPending(), false);

  await guard.run(async () => {
    calls += 1;
  });
  assert.equal(calls, 2);
});

test('pending guard unlocks after a failed request', async () => {
  const guard = createPendingGuard();

  await assert.rejects(guard.run(async () => {
    throw new Error('request failed');
  }), /request failed/);
  assert.equal(guard.isPending(), false);
});
