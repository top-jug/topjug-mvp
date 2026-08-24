import type { ApiRecordCount, ApiRecordCountInput, ApiRecordPause } from '../../app/api/record-api';
import type { ApiGymDetail } from '../../app/api/gym-api';
import type { DifficultyOption, RouteCounts } from '../../entities/record/types';

const KEY_SEPARATOR = '::';

export interface RecordSectorOption {
  id: string;
  name: string;
  wallName: string;
}

export function recordCountKey(sectorId: string, gradeId: string) {
  return `${sectorId}${KEY_SEPARATOR}${gradeId}`;
}

export function difficultyOptionsFromGym(gym: ApiGymDetail): DifficultyOption[] {
  return [...gym.grades]
    .sort((left, right) => right.rank - left.rank)
    .map((grade) => ({
      id: grade.id,
      color: grade.color || '#D4D4D4',
      name: grade.label,
      grade: grade.standardCode ?? grade.code,
    }));
}

export function sectorOptionsFromGym(gym: ApiGymDetail): RecordSectorOption[] {
  return [...gym.walls]
    .filter((wall) => wall.isActive !== false)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((wall) => [...(wall.sectors ?? [])]
      .filter((sector) => sector.isActive !== false)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((sector) => ({ id: sector.id, name: sector.name, wallName: wall.name })));
}

export function routeCountsFromApi(counts: ApiRecordCount[]): RouteCounts {
  return Object.fromEntries(counts.map((count) => [
    recordCountKey(count.sector.id, count.grade.id),
    { success: count.sends, attempt: count.attempts },
  ]));
}

export function routeCountsToApi(routeCounts: RouteCounts): ApiRecordCountInput[] {
  return Object.entries(routeCounts).flatMap(([key, count]) => {
    const [gymSectorId, gymGradeId] = key.split(KEY_SEPARATOR);
    if (!gymSectorId || !gymGradeId || (count.attempt === 0 && count.success === 0)) return [];
    return [{ gymGradeId, gymSectorId, attempts: count.attempt, sends: count.success }];
  });
}

export function calculateActiveDurationSeconds(startedAt: string, pauses: ApiRecordPause[], now = Date.now()) {
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return 0;

  const ended = Math.max(started, now);
  const pausedMilliseconds = pauses.reduce((total, pause) => {
    const pausedAt = new Date(pause.pausedAt).getTime();
    const resumedAt = pause.resumedAt ? new Date(pause.resumedAt).getTime() : ended;
    if (Number.isNaN(pausedAt) || Number.isNaN(resumedAt)) return total;
    return total + Math.max(0, Math.min(ended, resumedAt) - Math.max(started, pausedAt));
  }, 0);

  return Math.max(0, Math.floor((ended - started - pausedMilliseconds) / 1000));
}

export function formatElapsedTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
