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
  active: '정상 운영',
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

export type OperationsOperatingHour = {
  dayOfWeek: number;
  sequence: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

export type OperationsOperatingHourOverride = {
  date: string;
  sequence: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  note: string | null;
};

export type OperationsGymHours = {
  updatedAt: string;
  operatingHours: OperationsOperatingHour[];
  operatingHourOverrides: OperationsOperatingHourOverride[];
};

export type OperationsGym = OperationsGymSummary & {
  phone: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  nearbyDirections: string | null;
  operatingHoursNote: string | null;
  parkingInfo: string | null;
  calendarColor: string | null;
  calendarTextColor: string | null;
  facilities: string[];
  dayPassPrice: OperationsGymPrice;
  shoeRentalPrice: OperationsGymPrice;
  operatingHours: OperationsOperatingHour[];
  operatingHourOverrides: OperationsOperatingHourOverride[];
  createdAt: string;
};

export type OperationsGymFields = Omit<OperationsGym,
  'id' | 'createdAt' | 'updatedAt' | 'lastVerifiedAt' | 'operationStatus' | 'operatingHours' | 'operatingHourOverrides' | 'branchName' | 'address'> & {
    branchName: string | null;
    address: string;
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

export type OperationsGymPhoto = {
  gymMediaId: string;
  mediaAssetId: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  sortOrder: number;
  createdAt: string;
  url: string | null;
};

export type OperationsGymPhotos = {
  gym: Pick<OperationsGymSummary, 'id' | 'name' | 'branchName' | 'updatedAt'>;
  photos: OperationsGymPhoto[];
  maxPhotos: number;
};

export async function getOperationsGymPhotos(gymId: string, signal?: AbortSignal) {
  return (await apiRequest<ApiDataResponse<OperationsGymPhotos>>(`/ops/gyms/${gymId}/media`, { signal })).data;
}

export async function addOperationsGymPhoto(gymId: string, file: File, expectedUpdatedAt: string) {
  const body = new FormData();
  body.set('file', file);
  body.set('expectedUpdatedAt', expectedUpdatedAt);
  return (await apiRequest<ApiDataResponse<OperationsGymPhotos>>(`/ops/gyms/${gymId}/media`, {
    method: 'POST', body,
  })).data;
}

export async function deleteOperationsGymPhoto(gymId: string, gymMediaId: string, expectedUpdatedAt: string) {
  return (await apiRequest<ApiDataResponse<OperationsGymPhotos>>(`/ops/gyms/${gymId}/media/${gymMediaId}`, {
    method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }),
  })).data;
}

export type OperationsGymTag = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type OperationsGymTagFields = Pick<OperationsGymTag, 'code' | 'label' | 'description' | 'sortOrder' | 'isActive'>;

export type OperationsGymTagAssignments = {
  gym: Pick<OperationsGymSummary, 'id' | 'name' | 'branchName' | 'updatedAt'>;
  tagIds: string[];
};

export async function listOperationsGymTags(signal?: AbortSignal) {
  return (await apiRequest<ApiDataResponse<OperationsGymTag[]>>('/ops/gym-tags', { signal })).data;
}

export async function createOperationsGymTag(input: OperationsGymTagFields) {
  return (await apiRequest<ApiDataResponse<OperationsGymTag>>('/ops/gym-tags', {
    method: 'POST', body: JSON.stringify(input),
  })).data;
}

export async function updateOperationsGymTag(tagId: string, input: OperationsGymTagFields & { expectedUpdatedAt: string }) {
  return (await apiRequest<ApiDataResponse<OperationsGymTag>>(`/ops/gym-tags/${tagId}`, {
    method: 'PATCH', body: JSON.stringify(input),
  })).data;
}

export function deleteOperationsGymTag(tagId: string, expectedUpdatedAt: string) {
  return apiRequest<void>(`/ops/gym-tags/${tagId}`, {
    method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }),
  });
}

export async function getOperationsGymTagAssignments(gymId: string, signal?: AbortSignal) {
  return (await apiRequest<ApiDataResponse<OperationsGymTagAssignments>>(`/ops/gyms/${gymId}/tags`, { signal })).data;
}

export async function replaceOperationsGymTags(gymId: string, tagIds: string[], expectedUpdatedAt: string) {
  return (await apiRequest<ApiDataResponse<OperationsGymTagAssignments>>(`/ops/gyms/${gymId}/tags`, {
    method: 'PUT', body: JSON.stringify({ tagIds, expectedUpdatedAt }),
  })).data;
}

export type OperationsScheduleInput = {
  isClosed: boolean;
  intervals: Array<{ opensAt: string; closesAt: string }>;
};

export async function replaceOperationsWeeklyHours(
  gymId: string,
  days: Array<OperationsScheduleInput & { dayOfWeek: number }>,
  expectedUpdatedAt: string,
) {
  return (await apiRequest<ApiDataResponse<OperationsGymHours>>(`/ops/gyms/${gymId}/operating-hours`, {
    method: 'PUT', body: JSON.stringify({ days, expectedUpdatedAt }),
  })).data;
}

export async function createOperationsHourOverride(
  gymId: string,
  date: string,
  schedule: OperationsScheduleInput & { note: string | null },
  expectedUpdatedAt: string,
) {
  return (await apiRequest<ApiDataResponse<OperationsGymHours>>(`/ops/gyms/${gymId}/operating-hour-overrides/${date}`, {
    method: 'PUT', body: JSON.stringify({ ...schedule, expectedUpdatedAt }),
  })).data;
}

export async function deleteOperationsHourOverride(gymId: string, date: string, expectedUpdatedAt: string) {
  return (await apiRequest<ApiDataResponse<OperationsGymHours>>(`/ops/gyms/${gymId}/operating-hour-overrides/${date}`, {
    method: 'DELETE', body: JSON.stringify({ expectedUpdatedAt }),
  })).data;
}

export async function batchOperationsHourOverrides(
  gymId: string,
  input: OperationsScheduleInput & {
    startDate: string;
    endDate: string;
    note: string | null;
    overwriteExisting: boolean;
    expectedUpdatedAt: string;
  },
) {
  return (await apiRequest<ApiDataResponse<OperationsGymHours>>(`/ops/gyms/${gymId}/operating-hour-overrides/batch`, {
    method: 'POST', body: JSON.stringify(input),
  })).data;
}
