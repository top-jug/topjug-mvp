import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ClimbingRecord } from '../../entities/record/types';
import { listRecords, mapApiRecordSummary } from '../api/record-api';
import { useAuth } from '../../features/auth/AuthProvider';
import { shouldLoadProtectedResources } from '../../features/auth/auth-navigation';
import { createRecordHistoryAccountResetState, createRecordListFailure } from '../../features/record/record-async-state';

interface RecordHistoryContextValue {
  records: ClimbingRecord[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  paginationError: string | null;
  hasMore: boolean;
  addRecord: (record: ClimbingRecord) => void;
  getRecord: (recordId: string) => ClimbingRecord | undefined;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  retryLoadMore: () => Promise<void>;
}

const RecordHistoryContext = createContext<RecordHistoryContextValue | null>(null);

export function RecordHistoryProvider({ children }: PropsWithChildren) {
  const { status: authStatus, user } = useAuth();
  const [records, setRecords] = useState<ClimbingRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationError, setPaginationError] = useState<{ cursor: string; message: string } | null>(null);
  const requestIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);

  const fetchRecords = useCallback(async (options: { cursor?: string | null; replace: boolean }) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    if (options.replace) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    if (options.replace) setError(null);
    else setPaginationError(null);

    try {
      const payload = await listRecords({ cursor: options.cursor, limit: 20, signal: controller.signal });
      if (requestId !== requestIdRef.current) return;

      const nextRecords = payload.data.map(mapApiRecordSummary);
      setRecords((current) => {
        if (options.replace) return nextRecords;

        const seenIds = new Set(current.map((record) => record.id));
        return [...current, ...nextRecords.filter((record) => !seenIds.has(record.id))];
      });
      setNextCursor(payload.meta.nextCursor);
      if (options.replace) setPaginationError(null);
    } catch (fetchError) {
      if (requestId !== requestIdRef.current) return;
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
      const message = fetchError instanceof Error ? fetchError.message : '기록 목록을 불러오지 못했어요.';
      const failure = createRecordListFailure(options.replace ? null : options.cursor, message);
      if (failure.scope === 'pagination') setPaginationError({ cursor: failure.cursor, message: failure.message });
      else setError(failure.message);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    requestIdRef.current += 1;
    requestControllerRef.current?.abort();
    const reset = createRecordHistoryAccountResetState(authStatus === 'loading' || authStatus === 'authenticated');
    setRecords(reset.records);
    setNextCursor(reset.nextCursor);
    setError(reset.error);
    setPaginationError(reset.paginationError);
    setIsLoadingMore(reset.isLoadingMore);
    setIsLoading(reset.isLoading);
    if (shouldLoadProtectedResources(authStatus)) {
      void fetchRecords({ replace: true });
      return () => {
        requestIdRef.current += 1;
        requestControllerRef.current?.abort();
      };
    }
    return undefined;
  }, [authStatus, fetchRecords, user?.id]);

  const refresh = useCallback(() => fetchRecords({ replace: true }), [fetchRecords]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    await fetchRecords({ cursor: nextCursor, replace: false });
  }, [fetchRecords, isLoadingMore, nextCursor]);

  const retryLoadMore = useCallback(async () => {
    if (!paginationError || isLoadingMore) return;
    await fetchRecords({ cursor: paginationError.cursor, replace: false });
  }, [fetchRecords, isLoadingMore, paginationError]);

  const value = useMemo<RecordHistoryContextValue>(
    () => ({
      records,
      isLoading,
      isLoadingMore,
      error,
      paginationError: paginationError?.message ?? null,
      hasMore: Boolean(nextCursor),
      addRecord: (record) => {
        setRecords((current) => {
          const nextRecords = current.filter((currentRecord) => currentRecord.id !== record.id);
          return [record, ...nextRecords];
        });
      },
      getRecord: (recordId) => records.find((record) => record.id === recordId),
      refresh,
      loadMore,
      retryLoadMore,
    }),
    [error, isLoading, isLoadingMore, loadMore, nextCursor, paginationError, records, refresh, retryLoadMore],
  );

  return <RecordHistoryContext.Provider value={value}>{children}</RecordHistoryContext.Provider>;
}

export function useRecordHistory() {
  const context = useContext(RecordHistoryContext);

  if (!context) {
    throw new Error('useRecordHistory must be used within RecordHistoryProvider');
  }

  return context;
}
