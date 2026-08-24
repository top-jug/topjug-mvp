import { displayGymName } from '../../app/api/gym-api';
import { listRecords, type ApiRecordSummary } from '../../app/api/record-api';

const RECENT_GYM_LIMIT = 3;
const RECORD_PAGE_SIZE = 100;

export interface RecentGym {
  id: string;
  name: string;
  href: string;
}

type RecordPage = Awaited<ReturnType<typeof listRecords>>;
type ListRecordPage = (params: { cursor?: string | null; limit: number; signal?: AbortSignal }) => Promise<RecordPage>;

export function buildRecentGyms(records: ApiRecordSummary[], limit = RECENT_GYM_LIMIT): RecentGym[] {
  const seenGymIds = new Set<string>();
  const gyms: RecentGym[] = [];
  const newestVisits = records
    .map((record, index) => ({ record, index, startedAt: Date.parse(record.startedAt) }))
    .sort((left, right) => {
      const leftStartedAt = Number.isNaN(left.startedAt) ? Number.NEGATIVE_INFINITY : left.startedAt;
      const rightStartedAt = Number.isNaN(right.startedAt) ? Number.NEGATIVE_INFINITY : right.startedAt;
      return rightStartedAt - leftStartedAt || left.index - right.index;
    });

  for (const { record } of newestVisits) {
    if (seenGymIds.has(record.gym.id)) continue;
    seenGymIds.add(record.gym.id);
    gyms.push({
      id: record.gym.id,
      name: displayGymName(record.gym),
      href: `/gyms/${encodeURIComponent(record.gym.id)}`,
    });
    if (gyms.length === limit) break;
  }

  return gyms;
}

export async function loadRecentGyms(signal?: AbortSignal, listPage: ListRecordPage = listRecords) {
  const records: ApiRecordSummary[] = [];
  const seenRecordIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    signal?.throwIfAborted();
    const page = await listPage({ cursor, limit: RECORD_PAGE_SIZE, signal });
    signal?.throwIfAborted();
    for (const record of page.data) {
      if (seenRecordIds.has(record.id)) continue;
      seenRecordIds.add(record.id);
      records.push(record);
    }

    if (!page.meta.nextCursor) break;
    if (seenCursors.has(page.meta.nextCursor)) throw new Error('최근 기록 페이지를 끝까지 불러오지 못했어요.');
    cursor = page.meta.nextCursor;
    seenCursors.add(cursor);
  } while (cursor);

  return buildRecentGyms(records);
}
