import assert from 'node:assert/strict';
import test from 'node:test';
import type { GymOperatingHourOverride } from '../../src/app/api/gym-api';
import {
  buildGymSettingCalendar,
  getGymSettingEventMonths,
  OPERATION_STATUS_PRESENTATION,
  presentGymContacts,
  presentOperatingHourOverrides,
  presentWeeklyOperatingHours,
  selectInitialGymSettingMonth,
} from '../../src/features/gym-detail/gym-presentation';

test('all gym operation statuses have distinct, clear presentation labels', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(OPERATION_STATUS_PRESENTATION).map(([status, presentation]) => [status, presentation.label])),
    {
      active: '영업 중',
      temporarily_closed: '임시 휴업',
      closed: '폐업',
      opening_soon: '오픈 예정',
    },
  );
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

test('weekly hours and absent hours do not invent times or placeholders', () => {
  assert.deepEqual(presentWeeklyOperatingHours([], null), []);
  assert.deepEqual(presentWeeklyOperatingHours([], '평일 10:00 - 22:00\n주말 휴무'), ['평일 10:00 - 22:00', '주말 휴무']);
  assert.deepEqual(presentWeeklyOperatingHours([
    { dayOfWeek: 1, sequence: 0, opensAt: null, closesAt: null, isClosed: true },
  ], null), ['월요일 휴무']);
  assert.deepEqual(presentWeeklyOperatingHours([
    { dayOfWeek: 2, sequence: 0, opensAt: null, closesAt: null, isClosed: false },
  ], null), []);
});

test('contact presentation normalizes phone, website, and Instagram links', () => {
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

test('contact presentation uses API brand links as fallback and omits missing fields', () => {
  assert.deepEqual(presentGymContacts({ phone: null, websiteUrl: null, instagramUrl: null, brand: null }), []);
  assert.deepEqual(presentGymContacts({
    phone: null,
    websiteUrl: ' ',
    instagramUrl: '',
    brand: { id: 'brand-1', name: '브랜드', websiteUrl: 'https://brand.example', instagramUrl: 'https://instagram.com/brand/' },
  }).map(({ kind, href }) => ({ kind, href })), [
    { kind: 'website', href: 'https://brand.example' },
    { kind: 'instagram', href: 'https://instagram.com/brand/' },
  ]);
});

test('setting calendar focuses current event month, then nearest upcoming, then nearest historical', () => {
  const now = new Date(2026, 7, 24, 12);
  const events = [
    { startsAt: '2025-01-10T10:00:00' },
    { startsAt: '2026-08-30T10:00:00' },
    { startsAt: '2026-10-02T10:00:00' },
  ];
  assert.deepEqual(selectInitialGymSettingMonth(events, now), { year: 2026, month: 8 });
  assert.deepEqual(selectInitialGymSettingMonth(events.filter((event) => !event.startsAt.startsWith('2026-08')), now), { year: 2026, month: 10 });
  assert.deepEqual(selectInitialGymSettingMonth(events.slice(0, 1), now), { year: 2025, month: 1 });
  assert.deepEqual(selectInitialGymSettingMonth([], now), { year: 2026, month: 8 });
});

test('setting calendar exposes ordered event months and only marks events in the selected month', () => {
  const events = [
    { startsAt: '2026-10-02T10:00:00' },
    { startsAt: '2026-08-30T10:00:00' },
    { startsAt: '2026-10-18T10:00:00' },
    { startsAt: 'invalid' },
  ];
  assert.deepEqual(getGymSettingEventMonths(events), [{ year: 2026, month: 8 }, { year: 2026, month: 10 }]);
  assert.deepEqual(buildGymSettingCalendar(events, { year: 2026, month: 10 }).eventDays, [2, 18]);
});
