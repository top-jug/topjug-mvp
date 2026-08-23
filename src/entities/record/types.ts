export type RecordCountType = 'success' | 'attempt';
export type RecordSectorId = string;

export interface DifficultyOption {
  id: string;
  color: string;
  name: string;
  grade: string;
}

export interface CountPass {
  id: string;
  name: string;
  gym: string;
  gymIds: string[];
  remaining: number;
  total: number;
}

export interface PeriodPass {
  id: string;
  name: string;
  gym: string;
  gymIds: string[];
  daysLeft: number;
  expiryDate: string;
  expiryDay: string;
}

export type RouteCounts = Record<string, { success: number; attempt: number }>;

export interface RecordRouteDetail {
  id: string;
  sectorId: string;
  sectorName: string;
  wallId: string;
  wallName: string;
  gradeId: string;
  gradeCode: string;
  gradeLabel: string;
  gradeColor: string | null;
  gradeRank: number;
  success: number;
  attempt: number;
}

export interface ClimbingRecord {
  id: string;
  gym: string;
  date: string;
  duration: string;
  passLabel: string;
  rating: number;
  mode: 'easy' | 'normal';
  routeCounts: RouteCounts;
  apiCounts?: RecordRouteDetail[];
  startedAt?: string;
  endedAt?: string | null;
  accessType?: 'day_pass' | 'membership' | 'other';
  sessionType?: 'free' | 'training' | 'project';
  createdAt: string;
}
