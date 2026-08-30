import { ClimbingRecord, RecordRouteDetail } from '../../entities/record/types';
import { apiRequest, queryString } from './api-client';

interface ApiGymRef {
  id: string;
  name: string;
  branchName: string | null;
  logo?: {
    id: string;
    storageKey: string;
    contentType: string;
    url: string | null;
  } | null;
}

interface ApiMembershipRef {
  id: string;
  name: string;
}

export interface ApiRecordBase {
  id: string;
  gym: ApiGymRef;
  membership: ApiMembershipRef | null;
  accessType: 'day_pass' | 'membership' | 'other';
  status: 'in_progress' | 'completed' | 'cancelled';
  sessionType?: 'free' | 'training' | 'project';
  startedAt: string;
  endedAt: string | null;
  activeDurationSeconds: number | null;
  rating: number | null;
  mode: 'easy' | 'normal';
  note: string | null;
  sends: number;
  attempts: number;
  createdAt: string;
}

export interface ApiRecordSummary extends ApiRecordBase {}

export interface ApiRecordCount {
  id: string;
  sector: {
    id: string;
    code: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
  };
  wall: {
    id: string;
    code: string;
    name: string;
  };
  attempts: number;
  sends: number;
  grade: {
    id: string;
    code: string;
    label: string;
    color: string | null;
    standardCode: string | null;
    rank: number;
  };
}

export interface ApiRecordDetail extends ApiRecordBase {
  updatedAt: string;
  counts: ApiRecordCount[];
}

export interface ApiRecordPause {
  id: string;
  recordId: string;
  pausedAt: string;
  resumedAt: string | null;
}

export interface ApiActiveRecordSession extends ApiRecordDetail {
  isPaused: boolean;
  pauses: ApiRecordPause[];
}

export interface ApiStartedRecordSession {
  id: string;
  userId: string;
  gymId: string;
  membershipId: string | null;
  accessType: ApiRecordBase['accessType'];
  status: 'in_progress';
  sessionType?: ApiRecordBase['sessionType'];
  startedAt: string;
  endedAt: null;
  activeDurationSeconds: null;
  rating: null;
  mode: ApiRecordBase['mode'];
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRecordCountInput {
  gymGradeId: string;
  gymSectorId: string;
  attempts: number;
  sends: number;
}

export interface StartRecordSessionInput {
  gymId: string;
  accessType: ApiRecordBase['accessType'];
  membershipId?: string | null;
  startedAt: string;
  mode: ApiRecordBase['mode'];
  note?: string | null;
}

export interface CompleteRecordSessionInput {
  endedAt: string;
  rating?: number | null;
  note?: string | null;
  counts: ApiRecordCountInput[];
}

export interface RecordListParams {
  from?: string;
  to?: string;
  gymId?: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

export interface ApiShareSummary {
  id: string;
  status: 'active' | 'revoked' | 'expired';
  mediaAssetId: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ApiCreatedShare extends ApiShareSummary {
  token: string;
  apiPath: string;
  publicUrl: string | null;
}

export interface ApiPublicShare {
  id: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string | null;
  createdAt: string;
  media: {
    id: string;
    storageKey: string;
    contentType: string;
    status: string;
    deletedAt: string | null;
    url: string;
  } | null;
  record: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    rating: number | null;
    mode: 'easy' | 'normal';
    sessionType?: 'free' | 'training' | 'project';
    accessType: 'day_pass' | 'membership' | 'other';
    activeDurationSeconds: number | null;
    sends: number;
    attempts: number;
  };
  gym: ApiGymRef;
  membership: ApiMembershipRef | null;
}

export function listRecords(params: RecordListParams = {}) {
  return apiRequest<{ data: ApiRecordSummary[]; meta: { nextCursor: string | null } }>(
    `/api/v1/records${queryString({
      from: params.from,
      to: params.to,
      gymId: params.gymId,
      cursor: params.cursor,
      limit: params.limit ?? 20,
    })}`,
    { signal: params.signal },
  );
}

export function getRecord(recordId: string, signal?: AbortSignal) {
  return apiRequest<{ data: ApiRecordDetail }>(`/api/v1/records/${recordId}`, { signal });
}

export function getActiveRecordSession(signal?: AbortSignal) {
  return apiRequest<{ data: ApiActiveRecordSession | null }>('/api/v1/records/sessions', { signal });
}

export function startRecordSession(input: StartRecordSessionInput) {
  return apiRequest<{ data: ApiStartedRecordSession }>('/api/v1/records/sessions', {
    method: 'POST',
    body: input,
  });
}

export function replaceRecordSessionCounts(recordId: string, counts: ApiRecordCountInput[], signal?: AbortSignal) {
  return apiRequest<{ data: ApiRecordDetail }>(`/api/v1/records/${recordId}/counts`, {
    method: 'PUT',
    body: { counts },
    signal,
  });
}

export function pauseRecordSession(recordId: string, at = new Date().toISOString()) {
  return apiRequest<{ data: ApiRecordPause }>(`/api/v1/records/${recordId}/pause`, {
    method: 'POST',
    body: { at },
  });
}

export function resumeRecordSession(recordId: string, at = new Date().toISOString()) {
  return apiRequest<{ data: ApiRecordPause }>(`/api/v1/records/${recordId}/resume`, {
    method: 'POST',
    body: { at },
  });
}

export function completeRecordSession(recordId: string, input: CompleteRecordSessionInput) {
  return apiRequest<{ data: ApiRecordDetail }>(`/api/v1/records/${recordId}/complete`, {
    method: 'POST',
    body: input,
  });
}

export function cancelRecordSession(recordId: string, at = new Date().toISOString()) {
  return apiRequest<{ data: ApiRecordDetail }>(`/api/v1/records/${recordId}/cancel`, {
    method: 'POST',
    body: { at },
  });
}

export function listRecordShares(recordId: string, signal?: AbortSignal) {
  return apiRequest<{ data: ApiShareSummary[] }>(`/api/v1/records/${recordId}/shares`, { signal });
}

export function createRecordShare(recordId: string, input: { mediaAssetId?: string | null; expiresAt?: string | null } = {}) {
  return apiRequest<{ data: ApiCreatedShare }>(`/api/v1/records/${recordId}/shares`, {
    method: 'POST',
    body: input,
  });
}

export function revokeRecordShare(recordId: string, shareId: string, signal?: AbortSignal) {
  return apiRequest<void>(`/api/v1/records/${recordId}/shares/${shareId}`, { method: 'DELETE', signal });
}

export function getPublicShare(token: string) {
  return apiRequest<{ data: ApiPublicShare }>(`/api/v1/shares/${token}`, { auth: false });
}

export function mapApiRecordSummary(record: ApiRecordSummary): ClimbingRecord {
  return mapApiRecordBase(record, {
    [`summary-${record.id}`]: { success: record.sends, attempt: record.attempts },
  });
}

export function mapApiRecordDetail(record: ApiRecordDetail): ClimbingRecord {
  const apiCounts = record.counts.map(mapApiRecordCount);
  const routeCounts = Object.fromEntries(
    apiCounts.map((count) => [count.id, { success: count.success, attempt: count.attempt }]),
  );

  return mapApiRecordBase(record, Object.keys(routeCounts).length > 0 ? routeCounts : {
    [`summary-${record.id}`]: { success: record.sends, attempt: record.attempts },
  }, apiCounts);
}

export function mapPublicShareToRecord(share: ApiPublicShare): ClimbingRecord {
  return mapApiRecordBase({
    id: share.record.id,
    gym: share.gym,
    membership: share.membership,
    accessType: share.record.accessType,
    status: 'completed',
    startedAt: share.record.startedAt,
    endedAt: share.record.endedAt,
    activeDurationSeconds: share.record.activeDurationSeconds,
    rating: share.record.rating,
    mode: share.record.mode,
    note: null,
    sends: share.record.sends,
    attempts: share.record.attempts,
    createdAt: share.createdAt,
  }, {
    [`summary-${share.record.id}`]: { success: share.record.sends, attempt: share.record.attempts },
  });
}

export function publicShareUrl(share: Pick<ApiCreatedShare, 'token' | 'publicUrl'>) {
  if (share.publicUrl) return share.publicUrl;
  if (typeof window === 'undefined') return `/shares/${share.token}`;
  return `${window.location.origin}/shares/${share.token}`;
}

function mapApiRecordBase(
  record: ApiRecordBase,
  routeCounts: ClimbingRecord['routeCounts'],
  apiCounts?: RecordRouteDetail[],
): ClimbingRecord {
  return {
    id: record.id,
    gym: formatGymName(record.gym),
    date: formatDate(record.startedAt),
    duration: formatDuration(record.activeDurationSeconds, record.startedAt, record.endedAt),
    passLabel: formatAccess(record.accessType, record.membership),
    rating: record.rating,
    mode: record.mode,
    routeCounts,
    apiCounts,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    accessType: record.accessType,
    createdAt: record.createdAt,
  };
}

function mapApiRecordCount(count: ApiRecordCount): RecordRouteDetail {
  return {
    id: count.id,
    sectorId: count.sector.id,
    sectorName: count.sector.name,
    wallId: count.wall.id,
    wallName: count.wall.name,
    gradeId: count.grade.id,
    gradeCode: count.grade.code,
    gradeLabel: count.grade.label,
    gradeColor: count.grade.color,
    gradeRank: count.grade.rank,
    success: count.sends,
    attempt: count.attempts,
  };
}

function formatGymName(gym: ApiGymRef) {
  return gym.branchName ? `${gym.name} ${gym.branchName}` : gym.name;
}

function formatAccess(accessType: ApiRecordBase['accessType'], membership: ApiMembershipRef | null) {
  if (membership) return membership.name;
  if (accessType === 'day_pass') return '일일권';
  if (accessType === 'membership') return '회원권';
  return '기타 이용';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function formatDuration(activeDurationSeconds: number | null, startedAt: string, endedAt: string | null) {
  const seconds = activeDurationSeconds ?? durationSeconds(startedAt, endedAt);
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function durationSeconds(startedAt: string, endedAt: string | null) {
  if (!endedAt) return 0;
  const started = new Date(startedAt).getTime();
  const ended = new Date(endedAt).getTime();
  if (Number.isNaN(started) || Number.isNaN(ended)) return 0;
  return Math.max(0, Math.floor((ended - started) / 1000));
}
