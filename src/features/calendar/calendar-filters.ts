import type { ActiveGyms, CalendarData, CalendarGym, CalendarEntry } from '../../entities/calendar/types';

export type CalendarStatus = NonNullable<CalendarEntry['status']>;
export type ActiveStatuses = Record<CalendarStatus, boolean>;

export const ALL_CALENDAR_STATUSES: ActiveStatuses = {
  scheduled: true,
  completed: true,
  cancelled: true,
};

export function createAllCalendarStatuses(): ActiveStatuses {
  return { ...ALL_CALENDAR_STATUSES };
}

export function getCalendarGyms(calendarData: CalendarData): CalendarGym[] {
  const gyms = new Map<string, CalendarGym>();

  Object.values(calendarData).flat().forEach((entry) => {
    if (!entry.gymId || gyms.has(entry.gymId)) return;
    gyms.set(entry.gymId, {
      id: entry.gymId,
      name: entry.gym,
      color: entry.color ?? '#185FA5',
      lightBg: entry.lightBg ?? '#E6F1FB',
      darkText: entry.darkText ?? '#0C447C',
    });
  });

  return [...gyms.values()];
}

export function reconcileActiveGyms(previous: ActiveGyms, availableGyms: CalendarGym[]): ActiveGyms {
  return Object.fromEntries(availableGyms.map((gym) => [gym.id, previous[gym.id] ?? true]));
}

export function areAllCalendarGymsSelected(activeGyms: ActiveGyms, gyms: CalendarGym[]) {
  return gyms.length === 0 || gyms.every((gym) => activeGyms[gym.id]);
}

export function areAllCalendarStatusesSelected(activeStatuses: ActiveStatuses) {
  return Object.keys(ALL_CALENDAR_STATUSES).every((status) => activeStatuses[status as CalendarStatus]);
}

export function hasCalendarFilters(activeGyms: ActiveGyms, gyms: CalendarGym[], activeStatuses?: ActiveStatuses) {
  return !areAllCalendarGymsSelected(activeGyms, gyms)
    || Boolean(activeStatuses && !areAllCalendarStatusesSelected(activeStatuses));
}

export function filterCalendarData(
  calendarData: CalendarData,
  activeGyms: ActiveGyms,
  activeStatuses?: ActiveStatuses,
): CalendarData {
  return Object.fromEntries(
    Object.entries(calendarData).map(([day, entries]) => [
      Number(day),
      entries.filter((entry) => (
        Boolean(entry.gymId && activeGyms[entry.gymId])
        && (!activeStatuses || !entry.status || activeStatuses[entry.status])
      )),
    ]),
  );
}
