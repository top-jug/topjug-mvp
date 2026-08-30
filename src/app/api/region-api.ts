import { apiRequest } from './api-client';

export interface ApiRegion {
  code: string;
  name: string;
  level: number;
  parentCode: string | null;
  sortOrder: number;
}

export function listRegions(signal?: AbortSignal) {
  return apiRequest<{ data: ApiRegion[] }>('/api/v1/regions', { auth: false, signal });
}
