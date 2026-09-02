import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { addOperationsGymPhoto, deleteOperationsGymPhoto } from '../../src/features/operations/api';
import { apiClient } from '../../src/lib/api/client';

afterEach(() => {
  mock.restoreAll();
  apiClient.clearSession();
});

const responseData = {
  gym: { id: 'gym-1', name: '테스트 암장', branchName: null, updatedAt: '2026-09-02T10:00:01.000Z' },
  photos: [],
  maxPhotos: 20,
};

test('operations gym photo API sends multipart uploads and versioned deletes', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify({ data: responseData }), {
      status: String(init?.method).toUpperCase() === 'POST' ? 201 : 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  apiClient.setAccessToken('operations-token');

  const file = new File(['image'], 'gym.webp', { type: 'image/webp' });
  await addOperationsGymPhoto('gym-1', file, '2026-09-02T10:00:00.000Z');
  await deleteOperationsGymPhoto('gym-1', 'gym-media-1', '2026-09-02T10:00:01.000Z');

  const uploadHeaders = new Headers(requests[0].init?.headers);
  assert.equal(requests[0].url, '/api/v1/ops/gyms/gym-1/media');
  assert.equal(requests[0].init?.method, 'POST');
  assert.equal(uploadHeaders.get('authorization'), 'Bearer operations-token');
  assert.equal(uploadHeaders.has('content-type'), false);
  assert.ok(requests[0].init?.body instanceof FormData);
  assert.equal((requests[0].init?.body as FormData).get('file'), file);
  assert.equal((requests[0].init?.body as FormData).get('expectedUpdatedAt'), '2026-09-02T10:00:00.000Z');

  assert.equal(requests[1].url, '/api/v1/ops/gyms/gym-1/media/gym-media-1');
  assert.equal(requests[1].init?.method, 'DELETE');
  assert.equal(new Headers(requests[1].init?.headers).get('content-type'), 'application/json');
  assert.equal(requests[1].init?.body, JSON.stringify({ expectedUpdatedAt: '2026-09-02T10:00:01.000Z' }));
});
