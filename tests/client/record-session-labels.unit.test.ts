import assert from 'node:assert/strict';
import test from 'node:test';
import { RECORD_SESSION_TYPE_OPTIONS, recordSessionTypeLabel } from '../../src/features/record/session-labels';

test('record session type labels are shared and stable', () => {
  assert.deepEqual(RECORD_SESSION_TYPE_OPTIONS, [
    { value: 'free', label: '자유' },
    { value: 'training', label: '훈련' },
    { value: 'project', label: '프로젝트' },
  ]);
  assert.equal(recordSessionTypeLabel('free'), '자유');
  assert.equal(recordSessionTypeLabel('training'), '훈련');
  assert.equal(recordSessionTypeLabel('project'), '프로젝트');
  assert.equal(recordSessionTypeLabel('unexpected'), '알 수 없음');
  assert.equal(recordSessionTypeLabel(null), '알 수 없음');
});
