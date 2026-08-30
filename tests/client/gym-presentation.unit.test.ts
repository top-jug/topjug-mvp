import assert from 'node:assert/strict';
import test from 'node:test';
import type { GymOperatingHourOverride, GymSettingEvent } from '../../src/app/api/gym-api';
import {
  buildGymMapLink,
  buildGymMapSearchLink,
  carouselNavigationAvailability,
  carouselSlideForKey,
  clampCarouselSlide,
  getKakaoMapScriptSrc,
  gymDetailSlideLabel,
  hasKakaoLocationSource,
  isValidKakaoMapPoint,
  isHorizontalArrowKey,
  shouldSyncCarouselScroll,
  shouldTransferCarouselFocus,
} from '../../src/features/gym-detail/gym-detail-controls';
import {
  buildGymSettingCalendar,
  GYM_TIME_ZONE,
  OPERATION_STATUS_PRESENTATION,
  presentGymContacts,
  presentOperatingHourOverrides,
  presentWeeklyOperatingHours,
  selectGymDetailMediaPresentation,
  selectInitialGymSettingMonth,
  shiftGymSettingMonth,
} from '../../src/features/gym-detail/gym-presentation';

function settingEvent(overrides: Partial<GymSettingEvent> = {}): GymSettingEvent {
  return {
    id: 'event-1',
    status: 'scheduled',
    startsAt: '2026-08-30T10:00:00.000Z',
    endsAt: null,
    ...overrides,
  };
}

test('all gym lifecycle statuses use non-real-time presentation labels', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(OPERATION_STATUS_PRESENTATION).map(([status, presentation]) => [status, presentation.label])),
    {
      active: '정상 운영',
      temporarily_closed: '임시 휴업',
      closed: '폐업',
      opening_soon: '오픈 예정',
    },
  );
});

test('gym detail carousel clamps every navigation path to hard boundaries', () => {
  assert.equal(clampCarouselSlide(-2, 3), 0);
  assert.equal(clampCarouselSlide(8, 3), 2);
  assert.equal(clampCarouselSlide(1, 0), 0);
  assert.equal(carouselSlideForKey('ArrowLeft', 0, 3), 0);
  assert.equal(carouselSlideForKey('ArrowRight', 2, 3), 2);
  assert.deepEqual(carouselNavigationAvailability(0, 3), { hasPrevious: false, hasNext: true });
  assert.deepEqual(carouselNavigationAvailability(1, 3), { hasPrevious: true, hasNext: true });
  assert.deepEqual(carouselNavigationAvailability(2, 3), { hasPrevious: true, hasNext: false });
});

test('gym detail carousel maps navigation keys and exposes numbered labels', () => {
  assert.equal(carouselSlideForKey('ArrowLeft', 1, 3), 0);
  assert.equal(carouselSlideForKey('ArrowRight', 1, 3), 2);
  assert.equal(carouselSlideForKey('Home', 2, 3), 0);
  assert.equal(carouselSlideForKey('End', 0, 3), 2);
  assert.equal(carouselSlideForKey('Enter', 1, 3), null);
  assert.equal(gymDetailSlideLabel(0), '암장 캘린더, 1/3');
  assert.equal(gymDetailSlideLabel(2), '위치 지도, 3/3');
});

test('programmatic carousel scroll ignores transient slides until its target is observed', () => {
  assert.equal(shouldSyncCarouselScroll(1, 2), false);
  assert.equal(shouldSyncCarouselScroll(2, 2), true);
  assert.equal(shouldSyncCarouselScroll(1, null), true);
});

test('carousel focus transfers only when an active focused slide is deactivated', () => {
  assert.equal(shouldTransferCarouselFocus(0, 1, true), true);
  assert.equal(shouldTransferCarouselFocus(0, 0, true), false);
  assert.equal(shouldTransferCarouselFocus(0, 1, false), false);
});

test('calendar controls consume only horizontal arrow keys from outer carousel movement', () => {
  assert.equal(isHorizontalArrowKey('ArrowLeft'), true);
  assert.equal(isHorizontalArrowKey('ArrowRight'), true);
  assert.equal(isHorizontalArrowKey('Enter'), false);
  assert.equal(isHorizontalArrowKey(' '), false);
});

test('gym map links are offered only for complete valid coordinates', () => {
  assert.equal(buildGymMapLink(37.5665, 126.978), 'https://map.kakao.com/link/map/37.5665,126.978');
  assert.equal(buildGymMapSearchLink('서울특별시 종로구 청계천로 1', '테스트 암장'), 'https://map.kakao.com/link/search/%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EC%95%94%EC%9E%A5%20%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C%20%EC%A2%85%EB%A1%9C%EA%B5%AC%20%EC%B2%AD%EA%B3%84%EC%B2%9C%EB%A1%9C%201');
  assert.equal(buildGymMapSearchLink('   ', '   '), null);
  assert.equal(isValidKakaoMapPoint(37.5665, 126.978), true);
  assert.equal(buildGymMapLink(null, 126.978), null);
  assert.equal(buildGymMapLink(37.5665, null), null);
  assert.equal(buildGymMapLink(Number.NaN, 126.978), null);
  assert.equal(buildGymMapLink(91, 126.978), null);
  assert.equal(buildGymMapLink(37.5665, -181), null);
  assert.equal(isValidKakaoMapPoint(null, 126.978), false);
});

test('Kakao map SDK loader uses the public JavaScript key and deferred autoload', () => {
  assert.equal(
    getKakaoMapScriptSrc('test key'),
    'https://dapi.kakao.com/v2/maps/sdk.js?appkey=test%20key&libraries=services&autoload=false',
  );
});

test('Kakao map source can fall back from missing coordinates to a gym address', () => {
  assert.equal(hasKakaoLocationSource({ latitude: null, longitude: null, address: '서울특별시 종로구 청계천로 1' }), true);
  assert.equal(hasKakaoLocationSource({ latitude: 37.5665, longitude: 126.978, address: null }), true);
  assert.equal(hasKakaoLocationSource({ latitude: null, longitude: null, address: '   ' }), false);
});

test('gym detail media keeps logos separate from real photos and location maps', () => {
  const logo = { id: 'logo', type: 'logo' as const, storageKey: 'gyms/logo.png', contentType: 'image/png', url: '/media/logo.png', altText: null, sortOrder: 0 };
  const duplicateCover = { ...logo, id: 'cover-logo', type: 'cover' as const };
  const realCover = { id: 'cover', type: 'cover' as const, storageKey: 'gyms/cover.jpg', contentType: 'image/jpeg', url: '/media/cover.jpg', altText: null, sortOrder: 1 };
  const realPhoto = { id: 'photo', type: 'photo' as const, storageKey: 'gyms/photo.jpg', contentType: 'image/jpeg', url: '/media/photo.jpg', altText: null, sortOrder: 2 };
  const sectorMap = { id: 'sector-map', type: 'sector_map' as const, storageKey: 'gyms/sector.png', contentType: 'image/png', url: '/media/sector.png', altText: null, sortOrder: 3 };
  const locationMap = { id: 'map', type: 'map' as const, storageKey: 'gyms/location.png', contentType: 'image/png', url: '/media/location.png', altText: null, sortOrder: 4 };

  assert.deepEqual(selectGymDetailMediaPresentation({
    cover: duplicateCover,
    media: [logo, duplicateCover, realCover, realPhoto, sectorMap, locationMap],
  }), {
    logoUrl: '/media/logo.png',
    photos: ['/media/cover.jpg', '/media/photo.jpg'],
    locationMapImage: '/media/location.png',
  });
  assert.deepEqual(selectGymDetailMediaPresentation({ cover: duplicateCover, media: [logo, duplicateCover, sectorMap] }), {
    logoUrl: '/media/logo.png',
    photos: [],
    locationMapImage: null,
  });
});

test('special-date hours group open ranges and make closure precedence explicit', () => {
  const overrides: GymOperatingHourOverride[] = [
    { date: '2026-08-15', sequence: 1, opensAt: '16:00:00', closesAt: '20:00:00', isClosed: false, note: '광복절 단축 운영' },
    { date: '2026-08-15', sequence: 0, opensAt: '10:00:00', closesAt: '14:00:00', isClosed: false, note: '광복절 단축 운영' },
    { date: '2026-08-16', sequence: 0, opensAt: null, closesAt: null, isClosed: true, note: '시설 점검' },
  ];

  assert.deepEqual(presentOperatingHourOverrides(overrides), [
    { date: '2026년 8월 15일 (토)', hours: '10:00 - 14:00, 16:00 - 20:00', note: '광복절 단축 운영' },
    { date: '2026년 8월 16일 (일)', hours: '휴무', note: '시설 점검' },
  ]);
});

test('weekly structured hours and notes are preserved together without placeholders', () => {
  assert.deepEqual(presentWeeklyOperatingHours([], null), { hours: [], note: [] });
  assert.deepEqual(presentWeeklyOperatingHours([
    { dayOfWeek: 1, sequence: 0, opensAt: '10:00:00', closesAt: '22:00:00', isClosed: false },
    { dayOfWeek: 2, sequence: 0, opensAt: null, closesAt: null, isClosed: true },
  ], '공휴일 별도 공지'), {
    hours: ['월요일 10:00 - 22:00', '화요일 휴무'],
    note: ['공휴일 별도 공지'],
  });
  assert.deepEqual(presentWeeklyOperatingHours([], '평일 10:00 - 22:00\n주말 휴무'), {
    hours: [],
    note: ['평일 10:00 - 22:00', '주말 휴무'],
  });
  assert.deepEqual(presentWeeklyOperatingHours([
    { dayOfWeek: 2, sequence: 0, opensAt: null, closesAt: null, isClosed: false },
  ], null), { hours: [], note: [] });
});

test('contact presentation normalizes safe phone, website, and Instagram links', () => {
  const contacts = presentGymContacts({
    phone: ' 02-1234-5678 ',
    websiteUrl: 'example.com/gym',
    instagramUrl: '@topjug_gym',
    brand: null,
  });

  assert.deepEqual(contacts, [
    { kind: 'phone', label: '전화', value: '02-1234-5678', href: 'tel:0212345678', external: false },
    { kind: 'website', label: '웹사이트', value: '공식 웹사이트', href: 'https://example.com/gym', external: true },
    { kind: 'instagram', label: 'Instagram', value: '@topjug_gym', href: 'https://www.instagram.com/topjug_gym/', external: true },
  ]);
});

test('contact presentation rejects unsafe URLs and misleading Instagram hosts', () => {
  assert.deepEqual(presentGymContacts({
    phone: null,
    websiteUrl: 'javascript:alert(1)',
    instagramUrl: 'https://instagram.com.evil.example/topjug',
    brand: null,
  }), []);
  assert.deepEqual(presentGymContacts({
    phone: null,
    websiteUrl: 'data:text/html,bad',
    instagramUrl: 'https://evil.example/instagram.com/topjug',
    brand: null,
  }), []);
  assert.deepEqual(presentGymContacts({
    phone: null,
    websiteUrl: null,
    instagramUrl: 'https://instagram.com/p/not-a-handle',
    brand: null,
  }), []);
});

test('contact presentation normalizes known Instagram URLs and uses safe brand fallbacks', () => {
  assert.deepEqual(presentGymContacts({ phone: null, websiteUrl: null, instagramUrl: null, brand: null }), []);
  assert.deepEqual(presentGymContacts({
    phone: null,
    websiteUrl: 'ftp://unsafe.example',
    instagramUrl: 'mailto:fake@instagram.com',
    brand: {
      id: 'brand-1',
      name: '브랜드',
      websiteUrl: 'https://brand.example',
      instagramUrl: 'http://instagram.com/Brand.Name/?utm_source=test',
    },
  }).map(({ kind, href, value }) => ({ kind, href, value })), [
    { kind: 'website', href: 'https://brand.example/', value: '공식 웹사이트' },
    { kind: 'instagram', href: 'https://www.instagram.com/Brand.Name/', value: '@Brand.Name' },
  ]);
});

test('gym calendar uses Asia/Seoul dates rather than the viewer timezone', () => {
  assert.equal(GYM_TIME_ZONE, 'Asia/Seoul');
  const events = [settingEvent({
    startsAt: '2026-08-31T16:00:00.000Z',
    endsAt: '2026-08-31T17:00:00.000Z',
  })];
  assert.deepEqual(selectInitialGymSettingMonth(events, new Date('2026-08-01T00:00:00.000Z')), { year: 2026, month: 9 });
  assert.deepEqual(buildGymSettingCalendar(events, { year: 2026, month: 9 }).eventDays, [1]);
  assert.deepEqual(buildGymSettingCalendar(events, { year: 2026, month: 8 }).eventDays, []);
});

test('calendar focus ignores cancelled events and prefers current or nearest upcoming active span', () => {
  const now = new Date('2026-08-24T03:00:00.000Z');
  const events = [
    settingEvent({ id: 'old', status: 'completed', startsAt: '2025-01-10T01:00:00.000Z' }),
    settingEvent({ id: 'cancelled', status: 'cancelled', startsAt: '2026-08-30T01:00:00.000Z' }),
    settingEvent({ id: 'upcoming', startsAt: '2026-10-02T01:00:00.000Z' }),
  ];
  assert.deepEqual(selectInitialGymSettingMonth(events, now), { year: 2026, month: 10 });
  assert.deepEqual(selectInitialGymSettingMonth([
    settingEvent({ startsAt: '2026-07-31T16:00:00.000Z', endsAt: '2026-08-02T01:00:00.000Z' }),
  ], now), { year: 2026, month: 8 });
  assert.deepEqual(selectInitialGymSettingMonth(events.slice(0, 1), now), { year: 2025, month: 1 });
  assert.deepEqual(selectInitialGymSettingMonth([], now), { year: 2026, month: 8 });
});

test('scheduled and completed multi-day spans expand inclusively while cancelled spans are omitted', () => {
  const events = [
    settingEvent({
      id: 'scheduled',
      startsAt: '2026-08-31T14:30:00.000Z',
      endsAt: '2026-09-02T01:00:00.000Z',
    }),
    settingEvent({
      id: 'completed',
      status: 'completed',
      startsAt: '2026-09-04T15:30:00.000Z',
      endsAt: '2026-09-06T14:59:59.000Z',
    }),
    settingEvent({
      id: 'cancelled',
      status: 'cancelled',
      startsAt: '2026-09-10T01:00:00.000Z',
      endsAt: '2026-09-12T01:00:00.000Z',
    }),
  ];
  assert.deepEqual(buildGymSettingCalendar(events, { year: 2026, month: 8 }).eventDays, [31]);
  assert.deepEqual(buildGymSettingCalendar(events, { year: 2026, month: 9 }).eventDays, [1, 2, 5, 6]);
});

test('adjacent calendar navigation crosses years with or without events', () => {
  assert.deepEqual(shiftGymSettingMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftGymSettingMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftGymSettingMonth({ year: 2026, month: 8 }, 1), { year: 2026, month: 9 });
});
