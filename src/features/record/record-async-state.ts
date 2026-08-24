import { ApiClientError } from '../../app/api/api-client';

export type RecordFetchFailure =
  | { kind: 'not-found'; message: string }
  | { kind: 'authorization'; message: string }
  | { kind: 'transient'; message: string };

export type RecordListFailure =
  | { scope: 'initial'; message: string }
  | { scope: 'pagination'; cursor: string; message: string };

export function createRecordHistoryAccountResetState(isLoading: boolean) {
  return {
    records: [],
    nextCursor: null,
    error: null,
    paginationError: null,
    isLoadingMore: false,
    isLoading,
  };
}

export function createRecordListFailure(cursor: string | null | undefined, message: string): RecordListFailure {
  return cursor
    ? { scope: 'pagination', cursor, message }
    : { scope: 'initial', message };
}

export function classifyRecordFetchFailure(error: unknown, fallback: string): RecordFetchFailure {
  const message = error instanceof Error ? error.message : fallback;

  if (error instanceof ApiClientError) {
    if (error.status === 404) return { kind: 'not-found', message };
    if (error.status === 401 || error.status === 403) return { kind: 'authorization', message };
  }

  return { kind: 'transient', message };
}

export function createRequestVersionGuard() {
  const versions = new Map<string, number>();

  return {
    begin(resource: string) {
      const version = (versions.get(resource) ?? 0) + 1;
      versions.set(resource, version);
      return { resource, version };
    },
    isCurrent(request: { resource: string; version: number }) {
      return versions.get(request.resource) === request.version;
    },
    invalidate(resource?: string) {
      if (resource) {
        versions.set(resource, (versions.get(resource) ?? 0) + 1);
      } else {
        for (const [key, version] of versions) versions.set(key, version + 1);
      }
    },
  };
}
