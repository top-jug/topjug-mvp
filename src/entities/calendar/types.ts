export interface CalendarGym {
  id: string;
  name: string;
  color: string;
  lightBg: string;
  darkText: string;
}

export interface CalendarEntry {
  gym: string;
  gymId?: string;
  wall: string;
  recordId?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  startsAt?: string;
  endsAt?: string;
  color?: string;
  lightBg?: string;
  darkText?: string;
}

export type CalendarData = Record<number, CalendarEntry[]>;
export type ActiveGyms = Record<string, boolean>;
