import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError } from '../../src/app/api/api-client';
import {
  classifyRecordFetchFailure,
  createRecordHistoryAccountResetState,
  createRecordListFailure,
  createRequestVersionGuard,
} from '../../src/features/record/record-async-state';
import {
  clearSavedGymActionError,
  createSavedGymAccountResetState,
  createSavedGymActionErrorGuard,
  createSavedGymOperationGuard,
  setSavedGymActionError,
  shouldClearSavedGymErrorsOnViewChange,
} from '../../src/features/gym-search/saved-gym-action-state';

test('pagination failures retain the exact failed cursor for retry', () => {
  assert.deepEqual(createRecordListFailure('cursor-page-2', '일시 오류'), {
    scope: 'pagination',
    cursor: 'cursor-page-2',
    message: '일시 오류',
  });
  assert.deepEqual(createRecordListFailure(null, '첫 페이지 오류'), {
    scope: 'initial',
    message: '첫 페이지 오류',
  });
});

test('record fetch failures separate unavailable records from retryable failures', () => {
  assert.equal(classifyRecordFetchFailure(new ApiClientError('없음', 404, 'RECORD_NOT_FOUND'), 'fallback').kind, 'not-found');
  assert.equal(classifyRecordFetchFailure(new ApiClientError('권한 없음', 403, 'FORBIDDEN'), 'fallback').kind, 'authorization');
  assert.equal(classifyRecordFetchFailure(new ApiClientError('서버 오류', 503, 'UNAVAILABLE'), 'fallback').kind, 'transient');
  assert.equal(classifyRecordFetchFailure(new TypeError('network failed'), 'fallback').kind, 'transient');
});

test('stale record and share-list retries cannot settle over newer requests', () => {
  const guard = createRequestVersionGuard();
  const firstRecord = guard.begin('record');
  const firstShares = guard.begin('shares');
  const retriedRecord = guard.begin('record');

  assert.equal(guard.isCurrent(firstRecord), false);
  assert.equal(guard.isCurrent(retriedRecord), true);
  assert.equal(guard.isCurrent(firstShares), true);

  guard.invalidate();
  assert.equal(guard.isCurrent(retriedRecord), false);
  assert.equal(guard.isCurrent(firstShares), false);
});

test('saved-gym action errors remain scoped by gym and action', () => {
  let errors = setSavedGymActionError({}, { gymId: 'gym-a', action: 'save', message: 'A 저장 실패' });
  errors = setSavedGymActionError(errors, { gymId: 'gym-b', action: 'unsave', message: 'B 삭제 실패' });

  assert.deepEqual(errors['gym-a'], { gymId: 'gym-a', action: 'save', message: 'A 저장 실패' });
  assert.deepEqual(errors['gym-b'], { gymId: 'gym-b', action: 'unsave', message: 'B 삭제 실패' });

  const clearedA = clearSavedGymActionError(errors, 'gym-a');
  assert.equal(clearedA['gym-a'], undefined);
  assert.deepEqual(clearedA['gym-b'], errors['gym-b']);
  assert.deepEqual(clearSavedGymActionError(clearedA), {});
});

test('dismiss and navigation invalidate late saved-gym action errors only at their scope', () => {
  const guard = createSavedGymActionErrorGuard();
  const gymA = guard.begin('gym-a');
  const gymB = guard.begin('gym-b');

  guard.invalidate('gym-a');
  assert.equal(guard.isCurrent(gymA), false);
  assert.equal(guard.isCurrent(gymB), true);

  guard.invalidate();
  assert.equal(guard.isCurrent(gymB), false);
  assert.equal(guard.isCurrent(guard.begin('gym-b')), true);
});

test('rapid saved-gym actions admit one operation per gym before rerender', () => {
  const guard = createSavedGymOperationGuard();
  const firstA = guard.tryBegin('gym-a');

  assert.ok(firstA);
  assert.equal(guard.tryBegin('gym-a'), null);
  assert.ok(guard.tryBegin('gym-b'));
  assert.equal(guard.finish(firstA), true);
  assert.ok(guard.tryBegin('gym-a'));
});

test('account reset prevents an old operation from rolling back or cleaning up a new one', () => {
  const guard = createSavedGymOperationGuard();
  const oldOperation = guard.tryBegin('gym-a');
  assert.ok(oldOperation);

  guard.reset();
  const newOperation = guard.tryBegin('gym-a');
  assert.ok(newOperation);
  assert.equal(guard.isCurrent(oldOperation), false);
  assert.equal(guard.finish(oldOperation), false);
  assert.equal(guard.isCurrent(newOperation), true);

  assert.deepEqual(createSavedGymAccountResetState(true), {
    savedGyms: [], error: null, actionErrors: {}, pendingGymIds: [], isLoading: true,
  });
  assert.deepEqual(createRecordHistoryAccountResetState(true), {
    records: [], nextCursor: null, error: null, paginationError: null, isLoadingMore: false, isLoading: true,
  });
});

test('switching between search and saved views clears action errors', () => {
  assert.equal(shouldClearSavedGymErrorsOnViewChange('search', 'saved'), true);
  assert.equal(shouldClearSavedGymErrorsOnViewChange('saved', 'search'), true);
  assert.equal(shouldClearSavedGymErrorsOnViewChange('saved', 'saved'), false);
});
