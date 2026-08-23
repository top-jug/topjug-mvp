import { ClimbingRecord } from '../../entities/record/types';
import { RECORD_DIFFICULTIES } from '../../mocks/record';
import { getRecordTotals } from './record-summary';

const DIFFICULTY_HEX_COLORS = [
  '#9333EA',
  '#4F46E5',
  '#3B82F6',
  '#22C55E',
  '#84CC16',
  '#FACC15',
  '#F97316',
  '#EF4444',
];

export interface RecordShareOptions {
  selectedDifficultyIndexes: number[];
  comment: string;
}

export interface ShareDifficultySummary {
  difficultyIndex: number;
  colorClassName: string;
  colorHex: string;
  colorName: string;
  grade: string;
  success: number;
  attempt: number;
}

export interface RecordShareModel {
  totals: ReturnType<typeof getRecordTotals>;
  difficulties: ShareDifficultySummary[];
  highestCompletedDifficulty?: ShareDifficultySummary;
  durationLabel: string;
  comment: string;
}

export function getRecordDifficultySummaries(record: ClimbingRecord): ShareDifficultySummary[] {
  const summaries = new Map<number, ShareDifficultySummary>();

  if (record.apiCounts?.length) {
    const orderedCounts = [...record.apiCounts].sort((left, right) => left.gradeRank - right.gradeRank);
    const gradeIndexes = new Map<string, number>();

    orderedCounts.forEach((counts) => {
      if (counts.success === 0 && counts.attempt === 0) return;

      const difficultyIndex = gradeIndexes.get(counts.gradeId) ?? gradeIndexes.size;
      gradeIndexes.set(counts.gradeId, difficultyIndex);

      const current = summaries.get(difficultyIndex) ?? {
        difficultyIndex,
        colorClassName: '',
        colorHex: counts.gradeColor ?? DIFFICULTY_HEX_COLORS[difficultyIndex] ?? '#A3A3A3',
        colorName: counts.gradeCode,
        grade: counts.gradeLabel,
        success: 0,
        attempt: 0,
      };

      current.success += counts.success;
      current.attempt += counts.attempt;
      summaries.set(difficultyIndex, current);
    });

    return Array.from(summaries.values()).sort((left, right) => left.difficultyIndex - right.difficultyIndex);
  }

  Object.entries(record.routeCounts).forEach(([routeKey, counts]) => {
    if (counts.success === 0 && counts.attempt === 0) return;

    const separatorIndex = routeKey.lastIndexOf('-');
    const difficultyIndex = Number(routeKey.slice(separatorIndex + 1));
    const difficulty = RECORD_DIFFICULTIES[difficultyIndex];
    if (!difficulty || !Number.isInteger(difficultyIndex)) return;

    const current = summaries.get(difficultyIndex) ?? {
      difficultyIndex,
      colorClassName: difficulty.color,
      colorHex: DIFFICULTY_HEX_COLORS[difficultyIndex] ?? '#A3A3A3',
      colorName: difficulty.name,
      grade: difficulty.grade,
      success: 0,
      attempt: 0,
    };

    current.success += counts.success;
    current.attempt += counts.attempt;
    summaries.set(difficultyIndex, current);
  });

  return Array.from(summaries.values()).sort((left, right) => left.difficultyIndex - right.difficultyIndex);
}

export function createRecordShareModel(record: ClimbingRecord, options: RecordShareOptions): RecordShareModel {
  const allDifficulties = getRecordDifficultySummaries(record);
  const selectedIndexes = new Set(options.selectedDifficultyIndexes);

  return {
    totals: getRecordTotals(record),
    difficulties: allDifficulties.filter((difficulty) => selectedIndexes.has(difficulty.difficultyIndex)),
    highestCompletedDifficulty: [...allDifficulties].reverse().find((difficulty) => difficulty.success > 0),
    durationLabel: formatRecordDuration(record.duration),
    comment: options.comment.trim(),
  };
}

function formatRecordDuration(duration: string) {
  const [hours = 0, minutes = 0] = duration.split(':').map(Number);
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes}분`);

  return parts.join(' ');
}
