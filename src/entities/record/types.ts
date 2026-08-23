export type RecordCountType = 'success' | 'attempt';
export type RecordSectorId = 'easy' | 'sector1' | 'sector2';

export interface DifficultyOption {
  color: string;
  name: string;
  grade: string;
}

export interface CountPass {
  id: number;
  gym: string;
  remaining: number;
  total: number;
}

export interface PeriodPass {
  id: number;
  gym: string;
  daysLeft: number;
  expiryDate: string;
  expiryDay: string;
}

export type RouteCounts = Record<string, { success: number; attempt: number }>;

export interface ClimbingRecord {
  id: string;
  gym: string;
  date: string;
  duration: string;
  passLabel: string;
  rating: number;
  mode: 'easy' | 'normal';
  routeCounts: RouteCounts;
  createdAt: string;
}
