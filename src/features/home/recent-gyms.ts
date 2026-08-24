import { displayGymName, listRecentVisitedGyms, type ApiRecentVisitedGym } from '../../app/api/gym-api';

const RECENT_GYM_LIMIT = 3;

export interface RecentGym {
  id: string;
  name: string;
  href: string;
}

type ListRecentVisitedGyms = (signal?: AbortSignal) => ReturnType<typeof listRecentVisitedGyms>;

export function buildRecentGyms(visits: ApiRecentVisitedGym[]): RecentGym[] {
  return visits.slice(0, RECENT_GYM_LIMIT).map(({ gym }) => ({
    id: gym.id,
    name: displayGymName(gym),
    href: `/gyms/${encodeURIComponent(gym.id)}`,
  }));
}

export async function loadRecentGyms(signal?: AbortSignal, listVisits: ListRecentVisitedGyms = listRecentVisitedGyms) {
  const response = await listVisits(signal);
  return buildRecentGyms(response.data);
}
