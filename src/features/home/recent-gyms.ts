import { displayGymName } from '../../app/api/gym-api';
import { listRecords, type ApiRecordSummary } from '../../app/api/record-api';

const RECENT_GYM_LIMIT = 3;
const RECORD_PAGE_SIZE = 20;
const MAX_RECORD_PAGES = 3;

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

  for (const record of records) {
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
  const seenGymIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let pageNumber = 0; pageNumber < MAX_RECORD_PAGES; pageNumber += 1) {
    const page = await listPage({ cursor, limit: RECORD_PAGE_SIZE, signal });
    for (const record of page.data) {
      records.push(record);
      seenGymIds.add(record.gym.id);
    }
    if (seenGymIds.size >= RECENT_GYM_LIMIT || !page.meta.nextCursor || seenCursors.has(page.meta.nextCursor)) break;
    cursor = page.meta.nextCursor;
    seenCursors.add(cursor);
  }

  return buildRecentGyms(records);
}
