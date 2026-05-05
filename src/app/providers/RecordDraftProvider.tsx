import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

export type RecordPassType = '일일이용권' | '횟수권' | '기간권';

export type RecordDraft = {
  selectedGym: string;
  selectedDate: string;
  selectedStartTime: string;
  selectedPassType: RecordPassType | null;
  selectedPass: string | null;
};

interface RecordDraftContextValue {
  draft: RecordDraft | null;
  setDraft: (draft: RecordDraft) => void;
  clearDraft: () => void;
}

const RecordDraftContext = createContext<RecordDraftContextValue | null>(null);

export function RecordDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraftState] = useState<RecordDraft | null>(null);

  const value = useMemo(
    () => ({
      draft,
      setDraft: setDraftState,
      clearDraft: () => setDraftState(null),
    }),
    [draft]
  );

  return <RecordDraftContext.Provider value={value}>{children}</RecordDraftContext.Provider>;
}

export function useRecordDraft() {
  const context = useContext(RecordDraftContext);

  if (!context) {
    throw new Error('useRecordDraft must be used within RecordDraftProvider');
  }

  return context;
}
