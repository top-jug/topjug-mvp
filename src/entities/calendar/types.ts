export interface CalendarGym {
  name: string;
  color: string;
  lightBg: string;
  darkText: string;
}

export interface CalendarEntry {
  gym: string;
  wall: string;
}

export type CalendarData = Record<number, CalendarEntry[]>;
export type ActiveGyms = Record<string, boolean>;
