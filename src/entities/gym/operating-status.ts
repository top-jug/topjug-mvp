export const GYM_TIME_ZONE = 'Asia/Seoul';

export type GymTodayOperatingState =
  | 'open'
  | 'closed'
  | 'before_open'
  | 'between_intervals'
  | 'after_close'
  | 'hours_unavailable';

export interface GymTodayOperatingStatus {
  date: string;
  state: GymTodayOperatingState;
  source: 'override' | 'weekly' | null;
  opensAt: string | null;
  closesAt: string | null;
}

export interface WeeklyOperatingScheduleRow {
  dayOfWeek: number;
  sequence: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface OverrideOperatingScheduleRow {
  date: string;
  sequence: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface SeoulOperatingMoment {
  date: string;
  dayOfWeek: number;
  time: string;
}

const SEOUL_MOMENT_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: GYM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function getSeoulOperatingMoment(now = new Date()): SeoulOperatingMoment {
  const parts = Object.fromEntries(SEOUL_MOMENT_FORMAT.formatToParts(now).map((part) => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  return { date, dayOfWeek, time: `${parts.hour}:${parts.minute}:${parts.second}` };
}

function unavailable(date: string): GymTodayOperatingStatus {
  return { date, state: 'hours_unavailable', source: null, opensAt: null, closesAt: null };
}

export function resolveGymTodayOperatingStatus(
  weeklyHours: WeeklyOperatingScheduleRow[],
  overrides: OverrideOperatingScheduleRow[],
  now = new Date(),
): GymTodayOperatingStatus {
  const moment = getSeoulOperatingMoment(now);
  const todayOverrides = overrides.filter((entry) => entry.date === moment.date);
  const source = todayOverrides.length > 0 ? 'override' : 'weekly';
  const entries = todayOverrides.length > 0
    ? todayOverrides
    : weeklyHours.filter((entry) => entry.dayOfWeek === moment.dayOfWeek);

  if (entries.length === 0) return unavailable(moment.date);
  if (entries.some((entry) => entry.isClosed)) {
    return { date: moment.date, state: 'closed', source, opensAt: null, closesAt: null };
  }

  const intervals = entries
    .filter((entry) => entry.opensAt && entry.closesAt)
    .sort((left, right) => left.sequence - right.sequence);
  if (intervals.length === 0) return unavailable(moment.date);

  const active = intervals.find((interval) => interval.opensAt! <= moment.time && moment.time < interval.closesAt!);
  if (active) {
    return { date: moment.date, state: 'open', source, opensAt: active.opensAt, closesAt: active.closesAt };
  }

  const next = intervals.find((interval) => moment.time < interval.opensAt!);
  if (next) {
    return {
      date: moment.date,
      state: next === intervals[0] ? 'before_open' : 'between_intervals',
      source,
      opensAt: next.opensAt,
      closesAt: next.closesAt,
    };
  }

  return { date: moment.date, state: 'after_close', source, opensAt: null, closesAt: null };
}
