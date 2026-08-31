import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { displayGymName, getGym, listGyms, listGymTags, listRecentVisitedGyms } from '../../src/app/api/gym-api';
import { listRegions } from '../../src/app/api/region-api';
import { apiClient } from '../../src/lib/api/client';

afterEach(() => {
  mock.restoreAll();
  apiClient.clearSession();
});

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
        brand: {
          id: 'brand-1',
          name: '테스트 브랜드',
          websiteUrl: 'https://example.com',
          instagramUrl: 'https://instagram.com/example',
        },
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
  assert.deepEqual(response.data[0].brand, {
    id: 'brand-1',
    name: '테스트 브랜드',
    websiteUrl: 'https://example.com',
    instagramUrl: 'https://instagram.com/example',
  });
  assert.equal(response.data[0].cover, null);
});

test('gym list query sends multi-token Korean region intent to the server', async () => {
  let requestedUrl = '';
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  await listGyms({ q: ' 서울 종로 ', limit: 100 });

  assert.match(requestedUrl, /q=%EC%84%9C%EC%9A%B8\+%EC%A2%85%EB%A1%9C/);
});

test('gym list sends canonical region independently from free text', async () => {
  let requestedUrl = '';
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  await listGyms({ q: '클라이밍', regionCode: '11110', limit: 10 });

  assert.match(requestedUrl, /q=%ED%81%B4%EB%9D%BC%EC%9D%B4%EB%B0%8D/);
  assert.match(requestedUrl, /regionCode=11110/);
});

test('gym list repeats every selected facility in the server query', async () => {
  let requestedUrl = '';
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  await listGyms({ facility: ['shower', 'parking'], limit: 1 });

  const query = new URL(requestedUrl, 'https://topjug.test').searchParams;
  assert.deepEqual(query.getAll('facility'), ['shower', 'parking']);
  assert.equal(query.get('limit'), '1');
});

test('gym list repeats every selected tag and public tag catalog skips authentication', async () => {
  const requestedUrls: string[] = [];
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrls.push(String(input));
    if (String(input) === '/api/v1/gym-tags') {
      assert.equal(new Headers(init?.headers).has('authorization'), false);
      return new Response(JSON.stringify({ data: [{ code: 'shower', label: '샤워실', description: null, sortOrder: 10 }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  await listGyms({ tag: ['shower', 'parking'], limit: 1 });
  const tags = await listGymTags();

  const query = new URL(requestedUrls[0]!, 'https://topjug.test').searchParams;
  assert.deepEqual(query.getAll('tag'), ['shower', 'parking']);
  assert.deepEqual(tags.data, [{ code: 'shower', label: '샤워실', description: null, sortOrder: 10 }]);
});

test('region catalog uses the public read-only endpoint', async () => {
  let requestedUrl = '';
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [{ code: '11', name: '서울특별시', level: 1, parentCode: null, sortOrder: 10 }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const response = await listRegions();

  assert.equal(requestedUrl, '/api/v1/regions');
  assert.equal(response.data[0]?.code, '11');
});

test('gym detail adapter preserves operation, special hours, parking, and contact fields', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    data: {
      id: 'gym-1', name: '테스트 암장', branchName: null, address: '서울', regionCode: null,
      operationStatus: 'opening_soon', facilities: [], brand: null, cover: null, tags: [], dayPassPrice: null,
      phone: '02-1234-5678', websiteUrl: 'https://example.com', instagramUrl: 'https://instagram.com/example',
      nearbyDirections: null, operatingHoursNote: null, parkingInfo: '건물 지하 2시간 무료', media: [], operatingHours: [],
      operatingHourOverrides: [{ date: '2026-08-15', sequence: 0, opensAt: null, closesAt: null, isClosed: true, note: '광복절' }],
      prices: [], grades: [], walls: [], settingEvents: [{
        id: 'event-1', status: 'completed', startsAt: '2026-08-15T01:00:00.000Z', endsAt: '2026-08-17T01:00:00.000Z',
      }],
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } }));

  const { data } = await getGym('gym-1');
  assert.equal(data.operationStatus, 'opening_soon');
  assert.deepEqual(data.operatingHourOverrides, [{ date: '2026-08-15', sequence: 0, opensAt: null, closesAt: null, isClosed: true, note: '광복절' }]);
  assert.equal(data.parkingInfo, '건물 지하 2시간 무료');
  assert.equal(data.phone, '02-1234-5678');
  assert.equal(data.websiteUrl, 'https://example.com');
  assert.equal(data.instagramUrl, 'https://instagram.com/example');
  assert.deepEqual(data.settingEvents, [{
    id: 'event-1', status: 'completed', startsAt: '2026-08-15T01:00:00.000Z', endsAt: '2026-08-17T01:00:00.000Z',
  }]);
});

test('recent visited gyms use the authenticated dedicated endpoint and preserve response order and shape', async () => {
  let requestedUrl = '';
  let authorization = '';
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    return new Response(JSON.stringify({
      data: [
        { gym: { id: 'gym-2', name: '두번째', branchName: null }, lastVisitedAt: '2026-08-24T10:00:00.000Z' },
        { gym: { id: 'gym-1', name: '첫번째', branchName: '강남' }, lastVisitedAt: '2026-08-23T10:00:00.000Z' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  apiClient.setAccessToken('recent-gym-token');

  const response = await listRecentVisitedGyms();

  assert.equal(requestedUrl, '/api/v1/me/recent-gyms');
  assert.equal(authorization, 'Bearer recent-gym-token');
  assert.deepEqual(response.data, [
    { gym: { id: 'gym-2', name: '두번째', branchName: null }, lastVisitedAt: '2026-08-24T10:00:00.000Z' },
    { gym: { id: 'gym-1', name: '첫번째', branchName: '강남' }, lastVisitedAt: '2026-08-23T10:00:00.000Z' },
  ]);
});
