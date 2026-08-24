import { apiRequest, queryString } from './api-client';

export interface GymMediaReference {
  id: string;
  storageKey: string;
  contentType: string;
  url: string | null;
}

export interface GymTag {
  code: string;
  label: string;
}

export interface GymPrice {
  type?: 'day_pass' | 'shoe_rental';
  amount: number | null;
  currency: string;
  rawText: string;
}

export interface ApiGymSummary {
  id: string;
  name: string;
  branchName: string | null;
  address: string;
  regionCode: string | null;
  latitude: number | null;
  longitude: number | null;
  operationStatus: 'active' | 'temporarily_closed' | 'closed' | 'opening_soon';
  facilities: string[];
  calendarColor: string | null;
  calendarTextColor: string | null;
  brand: { id: string; name: string } | null;
  cover: GymMediaReference | null;
  tags: GymTag[];
  dayPassPrice: GymPrice | null;
}

export interface ApiRecentVisitedGym {
  gym: Pick<ApiGymSummary, 'id' | 'name' | 'branchName'>;
  lastVisitedAt: string;
}

export interface GymMedia extends GymMediaReference {
  type: 'logo' | 'cover' | 'photo' | 'map' | 'sector_map';
  altText: string | null;
  sortOrder: number;
}

export interface GymOperatingHours {
  dayOfWeek: number;
  sequence: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface GymGrade {
  id: string;
  code: string;
  label: string;
  color: string;
  standardCode: string | null;
  rank: number;
}

export interface GymSector {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  mapMedia?: GymMediaReference | null;
}

export interface GymWall {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  mapMedia: GymMediaReference | null;
  sectors: GymSector[];
}

export interface ApiGymDetail extends ApiGymSummary {
  phone: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  nearbyDirections: string | null;
  operatingHoursNote: string | null;
  parkingInfo: string | null;
  media: GymMedia[];
  operatingHours: GymOperatingHours[];
  prices: GymPrice[];
  grades: GymGrade[];
  walls: GymWall[];
  settingEvents: Array<{ id: string; startsAt: string }>;
}

export interface ListGymsInput {
  q?: string;
  regionCode?: string;
  facility?: string;
  tag?: string;
  limit?: number;
  signal?: AbortSignal;
}

function normalizeGymSummary(gym: ApiGymSummary): ApiGymSummary {
  return {
    id: gym.id,
    name: gym.name,
    branchName: gym.branchName,
    address: gym.address,
    regionCode: gym.regionCode,
    latitude: gym.latitude ?? null,
    longitude: gym.longitude ?? null,
    operationStatus: gym.operationStatus,
    facilities: gym.facilities,
    calendarColor: gym.calendarColor ?? null,
    calendarTextColor: gym.calendarTextColor ?? null,
    brand: gym.brand?.id && gym.brand.name ? gym.brand : null,
    cover: gym.cover,
    tags: gym.tags ?? [],
    dayPassPrice: gym.dayPassPrice ?? null,
  };
}

export async function listGyms(input: ListGymsInput = {}) {
  const { signal, ...query } = input;
  const response = await apiRequest<{ data: ApiGymSummary[] }>(
    `/api/v1/gyms${queryString({ ...query, limit: query.limit ?? 100 })}`,
    { auth: false, signal },
  );
  return { data: response.data.map(normalizeGymSummary) };
}

export async function getGym(gymId: string, signal?: AbortSignal) {
  const response = await apiRequest<{ data: ApiGymDetail }>(`/api/v1/gyms/${gymId}`, { auth: false, signal });
  return { data: { ...response.data, ...normalizeGymSummary(response.data) } };
}

export async function listSavedGyms() {
  const response = await apiRequest<{ data: ApiGymSummary[] }>('/api/v1/me/saved-gyms');
  return { data: response.data.map(normalizeGymSummary) };
}

export function listRecentVisitedGyms(signal?: AbortSignal) {
  return apiRequest<{ data: ApiRecentVisitedGym[] }>('/api/v1/me/recent-gyms', { signal });
}

export function saveGym(gymId: string) {
  return apiRequest<void>(`/api/v1/me/saved-gyms/${gymId}`, { method: 'PUT' });
}

export function unsaveGym(gymId: string) {
  return apiRequest<void>(`/api/v1/me/saved-gyms/${gymId}`, { method: 'DELETE' });
}

export function displayGymName(gym: Pick<ApiGymSummary, 'name' | 'branchName'>) {
  if (!gym.branchName || gym.name.includes(gym.branchName)) return gym.name;
  return `${gym.name} ${gym.branchName}`;
}
