import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ClimbingRecord } from '../../entities/record/types';
import { listRecords, mapApiRecordSummary } from '../api/record-api';

interface RecordHistoryContextValue {
  records: ClimbingRecord[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  addRecord: (record: ClimbingRecord) => void;
  getRecord: (recordId: string) => ClimbingRecord | undefined;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const RecordHistoryContext = createContext<RecordHistoryContextValue | null>(null);

export function RecordHistoryProvider({ children }: PropsWithChildren) {
  const [records, setRecords] = useState<ClimbingRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchRecords = useCallback(async (options: { cursor?: string | null; replace: boolean }) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (options.replace) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const payload = await listRecords({ cursor: options.cursor, limit: 20 });
      if (requestId !== requestIdRef.current) return;

      const nextRecords = payload.data.map(mapApiRecordSummary);
      setRecords((current) => {
        if (options.replace) return nextRecords;

        const seenIds = new Set(current.map((record) => record.id));
        return [...current, ...nextRecords.filter((record) => !seenIds.has(record.id))];
      });
      setNextCursor(payload.meta.nextCursor);
    } catch (fetchError) {
      if (requestId !== requestIdRef.current) return;
      setError(fetchError instanceof Error ? fetchError.message : '기록 목록을 불러오지 못했어요.');
    } finally {
      if (requestId !== requestIdRef.current) return;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecords({ replace: true });
  }, [fetchRecords]);

  const refresh = useCallback(() => fetchRecords({ replace: true }), [fetchRecords]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    await fetchRecords({ cursor: nextCursor, replace: false });
  }, [fetchRecords, isLoadingMore, nextCursor]);

  const value = useMemo<RecordHistoryContextValue>(
    () => ({
      records,
      isLoading,
      isLoadingMore,
      error,
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
    }),
    [error, isLoading, isLoadingMore, loadMore, nextCursor, records, refresh],
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
