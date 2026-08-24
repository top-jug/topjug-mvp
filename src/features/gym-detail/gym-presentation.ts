import type {
  ApiGymDetail,
  GymOperatingHourOverride,
  GymOperatingHours,
} from '../../app/api/gym-api';

export type GymOperationStatus = ApiGymDetail['operationStatus'];

export const OPERATION_STATUS_PRESENTATION: Record<GymOperationStatus, {
  label: string;
  description: string;
  className: string;
}> = {
  active: {
    label: '영업 중',
    description: '현재 운영 중인 암장입니다.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  temporarily_closed: {
    label: '임시 휴업',
    description: '현재 임시 휴업 중입니다. 방문 전 운영 재개 여부를 확인해 주세요.',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  closed: {
    label: '폐업',
    description: '폐업한 암장입니다.',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  opening_soon: {
    label: '오픈 예정',
    description: '아직 영업을 시작하지 않은 암장입니다.',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
};

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function timeLabel(value: string) {
  return value.slice(0, 5);
}

export function presentWeeklyOperatingHours(hours: GymOperatingHours[], note: string | null) {
  const noteLines = note?.split('\n').map((line) => line.trim()).filter(Boolean) ?? [];
  if (noteLines.length > 0) return noteLines;

  return hours.flatMap((entry) => {
    const day = DAY_LABELS[entry.dayOfWeek] ?? String(entry.dayOfWeek);
    if (entry.isClosed) return [`${day}요일 휴무`];
    if (!entry.opensAt || !entry.closesAt) return [];
    return [`${day}요일 ${timeLabel(entry.opensAt)} - ${timeLabel(entry.closesAt)}`];
  });
}

export interface PresentedOperatingHourOverride {
  date: string;
  hours: string;
  note: string | null;
}

function overrideDateLabel(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const weekday = DAY_LABELS[new Date(year, month - 1, day).getDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

export function presentOperatingHourOverrides(overrides: GymOperatingHourOverride[]): PresentedOperatingHourOverride[] {
  const byDate = new Map<string, GymOperatingHourOverride[]>();
  for (const override of overrides) {
    byDate.set(override.date, [...(byDate.get(override.date) ?? []), override]);
  }

  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, entries]) => {
    const sortedEntries = [...entries].sort((left, right) => left.sequence - right.sequence);
    const isClosed = sortedEntries.some((entry) => entry.isClosed);
    const ranges = sortedEntries
      .filter((entry) => !entry.isClosed && entry.opensAt && entry.closesAt)
      .map((entry) => `${timeLabel(entry.opensAt!)} - ${timeLabel(entry.closesAt!)}`);
    const notes = [...new Set(sortedEntries.map((entry) => entry.note?.trim()).filter((note): note is string => Boolean(note)))];

    return {
      date: overrideDateLabel(date),
      hours: isClosed ? '휴무' : ranges.join(', '),
      note: notes.length > 0 ? notes.join(' · ') : null,
    };
  });
}

export interface GymContactLink {
  kind: 'phone' | 'website' | 'instagram';
  label: string;
  value: string;
  href: string;
  external: boolean;
}

function textOrNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function externalUrl(value: string | null | undefined) {
  const normalized = textOrNull(value);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
}

function instagramLink(value: string | null | undefined) {
  const normalized = textOrNull(value);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const handle = normalized.replace(/^@/, '').replace(/^instagram\.com\//i, '').replace(/^www\.instagram\.com\//i, '').replace(/\/$/, '');
  return handle ? `https://www.instagram.com/${handle}/` : null;
}

function instagramValue(href: string) {
  try {
    const url = new URL(href);
    const handle = url.hostname.replace(/^www\./, '').toLowerCase() === 'instagram.com'
      ? url.pathname.split('/').filter(Boolean)[0]
      : null;
    return handle ? `@${handle}` : href;
  } catch {
    return href;
  }
}

export function presentGymContacts(gym: Pick<ApiGymDetail, 'phone' | 'websiteUrl' | 'instagramUrl' | 'brand'>): GymContactLink[] {
  const contacts: GymContactLink[] = [];
  const phone = textOrNull(gym.phone);
  const phoneTarget = phone?.replace(/[^\d+]/g, '') ?? null;
  const website = externalUrl(textOrNull(gym.websiteUrl) ?? gym.brand?.websiteUrl);
  const instagram = instagramLink(textOrNull(gym.instagramUrl) ?? gym.brand?.instagramUrl);

  if (phone && phoneTarget) contacts.push({ kind: 'phone', label: '전화', value: phone, href: `tel:${phoneTarget}`, external: false });
  if (website) contacts.push({ kind: 'website', label: '웹사이트', value: '공식 웹사이트', href: website, external: true });
  if (instagram) contacts.push({ kind: 'instagram', label: 'Instagram', value: instagramValue(instagram), href: instagram, external: true });
  return contacts;
}

export interface GymSettingMonth {
  year: number;
  month: number;
}

function monthKey(month: GymSettingMonth) {
  return month.year * 12 + month.month - 1;
}

function eventMonth(startsAt: string): GymSettingMonth | null {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function getGymSettingEventMonths(events: Array<{ startsAt: string }>) {
  const months = new Map<number, GymSettingMonth>();
  for (const event of events) {
    const month = eventMonth(event.startsAt);
    if (month) months.set(monthKey(month), month);
  }
  return [...months.entries()].sort(([left], [right]) => left - right).map(([, month]) => month);
}

export function selectInitialGymSettingMonth(events: Array<{ startsAt: string }>, now = new Date()): GymSettingMonth {
  const current = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const currentKey = monthKey(current);
  const months = getGymSettingEventMonths(events);
  return months.find((month) => monthKey(month) === currentKey)
    ?? months.find((month) => monthKey(month) > currentKey)
    ?? months.at(-1)
    ?? current;
}

export function buildGymSettingCalendar(events: Array<{ startsAt: string }>, focus: GymSettingMonth) {
  const firstDay = new Date(focus.year, focus.month - 1, 1).getDay();
  const lastDate = new Date(focus.year, focus.month, 0).getDate();
  const days: Array<number | ''> = [
    ...Array.from({ length: firstDay }, () => '' as const),
    ...Array.from({ length: lastDate }, (_, index) => index + 1),
  ];
  while (days.length % 7 !== 0) days.push('');

  return {
    days,
    eventDays: events.flatMap((event) => {
      const date = new Date(event.startsAt);
      return !Number.isNaN(date.getTime()) && date.getFullYear() === focus.year && date.getMonth() + 1 === focus.month
        ? [date.getDate()]
        : [];
    }),
    monthLabel: `${focus.year}년 ${focus.month}월`,
  };
}
