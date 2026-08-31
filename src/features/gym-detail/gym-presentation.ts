import type {
  ApiGymDetail,
  GymOperatingHourOverride,
  GymOperatingHours,
  GymSettingEvent,
} from '../../app/api/gym-api';
import { GYM_TIME_ZONE, type GymTodayOperatingStatus } from '../../entities/gym/operating-status';

export { GYM_TIME_ZONE } from '../../entities/gym/operating-status';

export type GymOperationStatus = ApiGymDetail['operationStatus'];

export const OPERATION_STATUS_PRESENTATION: Record<GymOperationStatus, {
  label: string;
  description: string;
  className: string;
}> = {
  active: {
    label: '정상 운영',
    description: '암장 자체는 정상 운영 상태입니다.',
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

export function presentGymAvailability(
  operationStatus: GymOperationStatus,
  todayStatus: GymTodayOperatingStatus,
) {
  if (operationStatus !== 'active') return OPERATION_STATUS_PRESENTATION[operationStatus];

  switch (todayStatus.state) {
    case 'open':
      return {
        label: '영업 중',
        description: todayStatus.closesAt ? `${timeLabel(todayStatus.closesAt)}에 영업을 종료합니다.` : '현재 영업 중입니다.',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    case 'closed':
      return {
        label: '오늘 휴무',
        description: '오늘은 운영하지 않습니다. 암장 자체는 정상 운영 상태입니다.',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
      };
    case 'before_open':
      return {
        label: '영업 전',
        description: todayStatus.opensAt ? `${timeLabel(todayStatus.opensAt)}에 영업을 시작합니다.` : '오늘 영업 시작 전입니다.',
        className: 'border-blue-200 bg-blue-50 text-blue-700',
      };
    case 'between_intervals':
      return {
        label: '브레이크 타임',
        description: todayStatus.opensAt ? `${timeLabel(todayStatus.opensAt)}에 영업을 재개합니다.` : '현재 영업시간 사이의 휴식 시간입니다.',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
      };
    case 'after_close':
      return {
        label: '영업 종료',
        description: '오늘 영업이 종료되었습니다.',
        className: 'border-slate-200 bg-slate-50 text-slate-700',
      };
    case 'hours_unavailable':
      return OPERATION_STATUS_PRESENTATION.active;
  }
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const SEOUL_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: GYM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function timeLabel(value: string) {
  return value.slice(0, 5);
}

export interface PresentedWeeklyOperatingHours {
  hours: string[];
  note: string[];
}

export interface GymDetailMediaPresentation {
  logoUrl: string | null;
  photos: string[];
  locationMapImage: string | null;
}

function uniqueUrls(urls: Array<string | null | undefined>) {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

export function selectGymDetailMediaPresentation(gym: Pick<ApiGymDetail, 'cover' | 'media'>): GymDetailMediaPresentation {
  const logo = gym.media.find((media) => media.type === 'logo' && media.url);
  const logoStorageKey = logo?.storageKey ?? null;
  const photoMedia = gym.media
    .filter((media) => (media.type === 'cover' || media.type === 'photo') && media.url)
    .filter((media) => !logoStorageKey || media.storageKey !== logoStorageKey);
  const cover = gym.cover?.url && gym.cover.storageKey !== logoStorageKey ? gym.cover : null;
  const locationMapImage = gym.media.find((media) => media.type === 'map' && media.url)?.url ?? null;

  return {
    logoUrl: logo?.url ?? null,
    photos: uniqueUrls([cover?.url, ...photoMedia.map((media) => media.url)]),
    locationMapImage,
  };
}

export function presentWeeklyOperatingHours(hours: GymOperatingHours[], note: string | null): PresentedWeeklyOperatingHours {
  return {
    hours: hours.flatMap((entry) => {
      const day = DAY_LABELS[entry.dayOfWeek] ?? String(entry.dayOfWeek);
      if (entry.isClosed) return [`${day}요일 휴무`];
      if (!entry.opensAt || !entry.closesAt) return [];
      return [`${day}요일 ${timeLabel(entry.opensAt)} - ${timeLabel(entry.closesAt)}`];
    }),
    note: note?.split('\n').map((line) => line.trim()).filter(Boolean) ?? [],
  };
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
  const weekday = DAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
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

function safeHttpUrl(value: string | null | undefined) {
  const normalized = textOrNull(value);
  if (!normalized) return null;
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(normalized);
  if (hasScheme && !/^https?:\/\//i.test(normalized)) return null;

  const candidate = hasScheme ? normalized : `https://${normalized}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

const INSTAGRAM_HANDLE = /^[a-z\d._]{1,30}$/i;
const INSTAGRAM_RESERVED_PATHS = new Set(['about', 'accounts', 'direct', 'explore', 'p', 'reel', 'reels', 'stories']);

function instagramLink(value: string | null | undefined) {
  const normalized = textOrNull(value);
  if (!normalized) return null;

  const directHandle = normalized.replace(/^@/, '');
  if (INSTAGRAM_HANDLE.test(directHandle)) return `https://www.instagram.com/${directHandle}/`;

  const candidate = /^(?:www\.)?instagram\.com\//i.test(normalized) ? `https://${normalized}` : normalized;
  const safeUrl = safeHttpUrl(candidate);
  if (!safeUrl) return null;

  const url = new URL(safeUrl);
  const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();
  const handle = url.pathname.split('/').filter(Boolean)[0] ?? '';
  if (hostname !== 'instagram.com' || !INSTAGRAM_HANDLE.test(handle) || INSTAGRAM_RESERVED_PATHS.has(handle.toLowerCase())) return null;
  return `https://www.instagram.com/${handle}/`;
}

function instagramValue(href: string) {
  return `@${new URL(href).pathname.split('/').filter(Boolean)[0]}`;
}

export function presentGymContacts(gym: Pick<ApiGymDetail, 'phone' | 'websiteUrl' | 'instagramUrl' | 'brand'>): GymContactLink[] {
  const contacts: GymContactLink[] = [];
  const phone = textOrNull(gym.phone);
  const phoneTarget = phone?.replace(/[^\d+]/g, '') ?? null;
  const website = safeHttpUrl(gym.websiteUrl) ?? safeHttpUrl(gym.brand?.websiteUrl);
  const instagram = instagramLink(gym.instagramUrl) ?? instagramLink(gym.brand?.instagramUrl);

  if (phone && phoneTarget) contacts.push({ kind: 'phone', label: '전화', value: phone, href: `tel:${phoneTarget}`, external: false });
  if (website) contacts.push({ kind: 'website', label: '웹사이트', value: '공식 웹사이트', href: website, external: true });
  if (instagram) contacts.push({ kind: 'instagram', label: 'Instagram', value: instagramValue(instagram), href: instagram, external: true });
  return contacts;
}

export interface GymSettingMonth {
  year: number;
  month: number;
}

interface GymCalendarDate extends GymSettingMonth {
  day: number;
}

function seoulCalendarDate(value: string | Date): GymCalendarDate | null {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(SEOUL_DATE_FORMAT.formatToParts(date).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function dateOrdinal(date: GymCalendarDate) {
  return Date.UTC(date.year, date.month - 1, date.day) / DAY_IN_MS;
}

function monthKey(month: GymSettingMonth) {
  return month.year * 12 + month.month - 1;
}

function eventRange(event: GymSettingEvent) {
  if (event.status === 'cancelled') return null;
  const start = seoulCalendarDate(event.startsAt);
  const parsedEnd = event.endsAt ? seoulCalendarDate(event.endsAt) : null;
  if (!start) return null;
  const end = parsedEnd && dateOrdinal(parsedEnd) >= dateOrdinal(start) ? parsedEnd : start;
  return { start, end };
}

function rangeOverlapsMonth(range: { start: GymCalendarDate; end: GymCalendarDate }, month: GymSettingMonth) {
  const monthStart = dateOrdinal({ ...month, day: 1 });
  const monthEnd = dateOrdinal({ ...shiftGymSettingMonth(month, 1), day: 1 }) - 1;
  return dateOrdinal(range.start) <= monthEnd && dateOrdinal(range.end) >= monthStart;
}

export function selectInitialGymSettingMonth(events: GymSettingEvent[], now = new Date()): GymSettingMonth {
  const currentDate = seoulCalendarDate(now);
  const current = currentDate ? { year: currentDate.year, month: currentDate.month } : { year: 1970, month: 1 };
  const activeRanges = events.map(eventRange).filter((range): range is NonNullable<typeof range> => Boolean(range));
  if (activeRanges.some((range) => rangeOverlapsMonth(range, current))) return current;

  const currentKey = monthKey(current);
  const eventMonths = activeRanges.map((range) => ({ year: range.start.year, month: range.start.month }));
  return eventMonths.sort((left, right) => monthKey(left) - monthKey(right)).find((month) => monthKey(month) > currentKey)
    ?? eventMonths.at(-1)
    ?? current;
}

export function shiftGymSettingMonth(month: GymSettingMonth, delta: -1 | 1): GymSettingMonth {
  const value = monthKey(month) + delta;
  return { year: Math.floor(value / 12), month: ((value % 12) + 12) % 12 + 1 };
}

export function buildGymSettingCalendar(events: GymSettingEvent[], focus: GymSettingMonth) {
  const firstDay = new Date(Date.UTC(focus.year, focus.month - 1, 1)).getUTCDay();
  const lastDate = new Date(Date.UTC(focus.year, focus.month, 0)).getUTCDate();
  const days: Array<number | ''> = [
    ...Array.from({ length: firstDay }, () => '' as const),
    ...Array.from({ length: lastDate }, (_, index) => index + 1),
  ];
  while (days.length % 7 !== 0) days.push('');

  const focusStart = dateOrdinal({ ...focus, day: 1 });
  const focusEnd = dateOrdinal({ ...focus, day: lastDate });
  const eventDays = new Set<number>();
  for (const event of events) {
    const range = eventRange(event);
    if (!range) continue;
    const first = Math.max(dateOrdinal(range.start), focusStart);
    const last = Math.min(dateOrdinal(range.end), focusEnd);
    for (let ordinal = first; ordinal <= last; ordinal += 1) {
      eventDays.add(new Date(ordinal * DAY_IN_MS).getUTCDate());
    }
  }

  return {
    days,
    eventDays: [...eventDays].sort((left, right) => left - right),
    monthLabel: `${focus.year}년 ${focus.month}월`,
  };
}
