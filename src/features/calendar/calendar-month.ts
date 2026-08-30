export interface CalendarMonthCell {
  key: string;
  day: number | null;
  year: number;
  month: number;
}

export type CalendarWeekdayKind = 'weekday' | 'saturday' | 'sunday';
export type CalendarDateTone = 'selected-today' | 'selected' | 'today' | 'saturday' | 'sunday' | 'weekday';

export function getCalendarWeekdayKind(columnIndex: number): CalendarWeekdayKind {
  if (columnIndex === 0) return 'sunday';
  if (columnIndex === 6) return 'saturday';
  return 'weekday';
}

export function getCalendarDateTone(input: {
  isSelected: boolean;
  isToday: boolean;
  weekdayKind: CalendarWeekdayKind;
}): CalendarDateTone {
  if (input.isSelected && input.isToday) return 'selected-today';
  if (input.isSelected) return 'selected';
  if (input.isToday) return 'today';
  return input.weekdayKind;
}

export function getLocalCalendarDate(now = new Date()) {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function shiftCalendarMonth(year: number, month: number, delta: number) {
  const shiftedDate = new Date(year, month - 1 + delta, 1);
  return { year: shiftedDate.getFullYear(), month: shiftedDate.getMonth() + 1 };
}

export function getCalendarMonthRange(year: number, month: number) {
  return {
    from: new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString(),
    to: new Date(year, month, 0, 23, 59, 59, 999).toISOString(),
  };
}

export function buildMonthCells(year: number, month: number): CalendarMonthCell[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = new Date(year, month - 1, 1).getDay();
  const cells: CalendarMonthCell[] = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ key: `blank-start-${year}-${month}-${index}`, day: null, year, month });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `day-${year}-${month}-${day}`, day, year, month });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-end-${year}-${month}-${cells.length}`, day: null, year, month });
  }

  return cells;
}
