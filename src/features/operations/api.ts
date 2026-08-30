import { apiRequest } from '../../lib/api/client';
import type { ApiDataResponse } from '../../lib/api/types';

export type OperationsSession = {
  userId: string;
  role: 'operations_admin';
};

export async function verifyOperationsSession(signal?: AbortSignal) {
  const response = await apiRequest<ApiDataResponse<OperationsSession>>('/ops/session', { signal });
  return response.data;
}

export const operationStatusLabels = {
  active: '운영 중',
  temporarily_closed: '임시 휴업',
  closed: '폐업',
  opening_soon: '오픈 예정',
} as const;

export type GymOperationStatus = keyof typeof operationStatusLabels;

export type OperationsGymSummary = {
  id: string;
  name: string;
  branchName: string | null;
  address: string;
  operationStatus: GymOperationStatus;
  lastVerifiedAt: string | null;
  updatedAt: string;
};

export type OperationsGymPrice = { amount: number | null; rawText: string } | null;

export type OperationsGym = OperationsGymSummary & {
  brandId: string | null;
  regionCode: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  nearbyDirections: string | null;
  operatingHoursNote: string | null;
  parkingInfo: string | null;
  calendarColor: string | null;
  calendarTextColor: string | null;
  dayPassPrice: OperationsGymPrice;
  shoeRentalPrice: OperationsGymPrice;
  createdAt: string;
};

export type OperationsGymFields = Omit<OperationsGym,
  'id' | 'createdAt' | 'updatedAt' | 'lastVerifiedAt' | 'operationStatus' | 'branchName' | 'address'> & {
    branchName: string | null;
    address: string;
  };

export type OperationsGymOptions = {
  brands: Array<{ id: string; name: string }>;
  regions: Array<{ code: string; name: string; level: number; parentCode: string | null }>;
};

export async function listOperationsGyms(
  query: { q?: string; operationStatus?: GymOperationStatus; page: number; limit?: number },
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({ page: String(query.page), limit: String(query.limit ?? 20) });
  if (query.q) search.set('q', query.q);
  if (query.operationStatus) search.set('operationStatus', query.operationStatus);
  return apiRequest<{ data: OperationsGymSummary[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(`/ops/gyms?${search}`, { signal });
}

export async function getOperationsGym(gymId: string, signal?: AbortSignal) {
  return (await apiRequest<ApiDataResponse<OperationsGym>>(`/ops/gyms/${gymId}`, { signal })).data;
}

export async function getOperationsGymOptions(signal?: AbortSignal) {
  return (await apiRequest<ApiDataResponse<OperationsGymOptions>>('/ops/gyms/options', { signal })).data;
}

export async function createOperationsGym(input: OperationsGymFields & { operationStatus: GymOperationStatus }) {
  return (await apiRequest<ApiDataResponse<OperationsGym>>('/ops/gyms', { method: 'POST', body: JSON.stringify(input) })).data;
}

export async function updateOperationsGym(gymId: string, input: OperationsGymFields & { expectedUpdatedAt: string }) {
  return (await apiRequest<ApiDataResponse<OperationsGym>>(`/ops/gyms/${gymId}`, { method: 'PATCH', body: JSON.stringify(input) })).data;
}

export async function updateOperationsGymStatus(gymId: string, operationStatus: GymOperationStatus, expectedUpdatedAt: string) {
  return (await apiRequest<ApiDataResponse<OperationsGym>>(`/ops/gyms/${gymId}/operation-status`, {
    method: 'PATCH', body: JSON.stringify({ operationStatus, expectedUpdatedAt }),
  })).data;
}

export async function verifyOperationsGym(gymId: string, expectedUpdatedAt: string) {
  return (await apiRequest<ApiDataResponse<OperationsGym>>(`/ops/gyms/${gymId}/verification`, {
    method: 'POST', body: JSON.stringify({ expectedUpdatedAt }),
  })).data;
}
