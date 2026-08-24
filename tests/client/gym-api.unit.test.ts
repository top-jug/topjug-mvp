import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { displayGymName, listGyms } from '../../src/app/api/gym-api';

afterEach(() => mock.restoreAll());

test('gym display name does not duplicate an included branch name', () => {
  assert.equal(displayGymName({ name: '담장 신촌', branchName: '신촌' }), '담장 신촌');
  assert.equal(displayGymName({ name: '더클라임', branchName: '강남' }), '더클라임 강남');
});

test('gym list query preserves required contract fields and normalizes optional summary fields', async () => {
  let requestedUrl = '';
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      data: [{
        id: 'gym-1',
        name: '테스트 암장',
        branchName: null,
        address: '서울 강남구',
        regionCode: null,
        operationStatus: 'temporarily_closed',
        facilities: ['parking'],
        cover: null,
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  const response = await listGyms({ q: '테스트 암장', limit: 10 });

  assert.match(requestedUrl, /^\/api\/v1\/gyms\?/);
  assert.match(requestedUrl, /q=%ED%85%8C%EC%8A%A4%ED%8A%B8\+%EC%95%94%EC%9E%A5/);
  assert.match(requestedUrl, /limit=10/);
  assert.deepEqual(response.data[0].tags, []);
  assert.equal(response.data[0].operationStatus, 'temporarily_closed');
  assert.deepEqual(response.data[0].facilities, ['parking']);
  assert.equal(response.data[0].cover, null);
});
