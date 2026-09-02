import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import {
  addOperationsGymPhoto,
  createOperationsSettingEvent,
  deleteOperationsGymPhoto,
  deleteOperationsSettingEvent,
  listOperationsSettingEvents,
  updateOperationsSettingEvent,
} from '../../src/features/operations/api';
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

test('operations setting-event API sends filters, fields, versions, and soft deletes', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const settingEvent = {
    id: 'event-1',
    gymId: 'gym-1',
    gym: { id: 'gym-1', name: '테스트 암장', branchName: null },
    title: 'A벽 정기 세팅',
    status: 'scheduled' as const,
    startsAt: '2026-09-10T01:00:00.000Z',
    endsAt: '2026-09-10T05:00:00.000Z',
    note: null,
    sectors: [],
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
  };
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    if (String(init?.method).toUpperCase() === 'DELETE') return new Response(null, { status: 204 });
    const data = String(input).includes('?') ? [settingEvent] : settingEvent;
    return new Response(JSON.stringify({ data }), {
      status: String(init?.method).toUpperCase() === 'POST' ? 201 : 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  apiClient.setAccessToken('operations-token');

  await listOperationsSettingEvents({
    gymId: 'gym-1',
    status: 'scheduled',
    from: '2026-08-31T15:00:00.000Z',
    to: '2026-09-30T14:59:59.999Z',
  });
  const fields = {
    title: 'A벽 정기 세팅',
    startsAt: '2026-09-10T01:00:00.000Z',
    endsAt: '2026-09-10T05:00:00.000Z',
    note: null,
    sectorIds: ['sector-1'],
  };
  await createOperationsSettingEvent('gym-1', fields);
  await updateOperationsSettingEvent('event-1', {
    status: 'completed',
    expectedUpdatedAt: settingEvent.updatedAt,
  });
  await deleteOperationsSettingEvent('event-1', settingEvent.updatedAt);

  assert.equal(requests[0].url, '/api/v1/ops/setting-events?from=2026-08-31T15%3A00%3A00.000Z&to=2026-09-30T14%3A59%3A59.999Z&gymId=gym-1&status=scheduled');
  assert.equal(requests[0].init?.method, undefined);
  assert.equal(requests[1].url, '/api/v1/ops/setting-events');
  assert.equal(requests[1].init?.method, 'POST');
  assert.equal(requests[1].init?.body, JSON.stringify({ gymId: 'gym-1', ...fields }));
  assert.equal(requests[2].url, '/api/v1/ops/setting-events/event-1');
  assert.equal(requests[2].init?.method, 'PATCH');
  assert.equal(requests[2].init?.body, JSON.stringify({ status: 'completed', expectedUpdatedAt: settingEvent.updatedAt }));
  assert.equal(requests[3].url, '/api/v1/ops/setting-events/event-1');
  assert.equal(requests[3].init?.method, 'DELETE');
  assert.equal(requests[3].init?.body, JSON.stringify({ expectedUpdatedAt: settingEvent.updatedAt }));
});
