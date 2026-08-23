import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { ClimbingRecord } from '../../entities/record/types';
import { INITIAL_RECORD_HISTORY } from '../../mocks/record';

const STORAGE_KEY = 'topjug.records';

interface RecordHistoryContextValue {
  records: ClimbingRecord[];
  addRecord: (record: ClimbingRecord) => void;
  getRecord: (recordId: string) => ClimbingRecord | undefined;
}

const RecordHistoryContext = createContext<RecordHistoryContextValue | null>(null);

function loadRecords() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ClimbingRecord[]) : INITIAL_RECORD_HISTORY;
  } catch {
    return INITIAL_RECORD_HISTORY;
  }
}

export function RecordHistoryProvider({ children }: PropsWithChildren) {
  const [records, setRecords] = useState<ClimbingRecord[]>(loadRecords);

  const value = useMemo<RecordHistoryContextValue>(
    () => ({
      records,
      addRecord: (record) => {
        setRecords((current) => {
          const nextRecords = [record, ...current];
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
          return nextRecords;
        });
      },
      getRecord: (recordId) => records.find((record) => record.id === recordId),
    }),
    [records],
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
