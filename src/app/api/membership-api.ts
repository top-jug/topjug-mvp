import { apiRequest, queryString } from './api-client';

export interface ApiGymSummary {
  id: string;
  name: string;
  branchName: string | null;
  address: string;
  calendarColor: string | null;
  calendarTextColor: string | null;
}

export interface ApiMembership {
  id: string;
  name: string;
  type: 'count' | 'period';
  gymIds: string[];
  gyms: Array<{ id: string; name: string; branchName: string | null }>;
  totalUses: number | null;
  remainingUses: number | null;
  validFrom: string;
  validUntil: string;
  note: string | null;
  homeFavorite: boolean;
  homeOrder: number | null;
  createdAt: string;
  updatedAt: string;
  eligibilityStatus: 'active' | 'unassigned' | 'not_started' | 'expired' | 'exhausted';
}

export interface MembershipInput {
  name: string;
  type: 'count' | 'period';
  gymIds: string[];
  totalUses: number | null;
  remainingUses: number | null;
  validFrom: string;
  validUntil: string;
  note: string | null;
  homeFavorite: boolean;
  homeOrder: number | null;
}

export function listGyms() {
  return apiRequest<{ data: ApiGymSummary[] }>(`/api/v1/gyms${queryString({ limit: 100 })}`, { auth: false });
}

export function listMemberships() {
  return apiRequest<{ data: ApiMembership[] }>('/api/v1/memberships');
}

export function createMembership(input: MembershipInput) {
  return apiRequest<{ data: ApiMembership }>('/api/v1/memberships', { method: 'POST', body: input });
}

export function replaceMembership(membershipId: string, input: MembershipInput) {
  return apiRequest<{ data: ApiMembership }>(`/api/v1/memberships/${membershipId}`, { method: 'PUT', body: input });
}

export function archiveMembership(membershipId: string) {
  return apiRequest<void>(`/api/v1/memberships/${membershipId}`, { method: 'DELETE' });
}
