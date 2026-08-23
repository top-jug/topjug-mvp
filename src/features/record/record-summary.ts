import { ClimbingRecord } from '../../entities/record/types';

export function getRecordTotals(record: ClimbingRecord) {
  return Object.values(record.routeCounts).reduce(
    (totals, count) => ({
      success: totals.success + count.success,
      attempt: totals.attempt + count.attempt,
    }),
    { success: 0, attempt: 0 },
  );
}
