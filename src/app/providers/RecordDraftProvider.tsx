import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import type { ApiActiveRecordSession, ApiRecordBase } from '../api/record-api';

export type RecordPassType = '일일이용권' | '횟수권' | '기간권' | '회원권' | '기타';

export type RecordDraft = {
  recordId: string;
  selectedGymId: string;
  selectedGym: string;
  selectedDate: string;
  selectedStartTime: string;
  startedAt: string;
  selectedPassType: RecordPassType | null;
  selectedPass: string | null;
  membershipId: string | null;
  accessType: ApiRecordBase['accessType'];
  mode: ApiRecordBase['mode'];
  sessionType: ApiRecordBase['sessionType'];
};

function formatGymName(gym: ApiActiveRecordSession['gym']) {
  if (!gym.branchName || gym.name.includes(gym.branchName)) return gym.name;
  return `${gym.name} ${gym.branchName}`;
}

function localDateParts(value: string) {
  const date = new Date(value);
  return {
    date: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`,
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

export function recordDraftFromActiveSession(session: ApiActiveRecordSession): RecordDraft {
  const started = localDateParts(session.startedAt);
  const selectedPassType: RecordPassType = session.accessType === 'day_pass'
    ? '일일이용권'
    : session.accessType === 'membership'
      ? '회원권'
      : '기타';

  return {
    recordId: session.id,
    selectedGymId: session.gym.id,
    selectedGym: formatGymName(session.gym),
    selectedDate: started.date,
    selectedStartTime: started.time,
    startedAt: session.startedAt,
    selectedPassType,
    selectedPass: session.membership?.name ?? null,
    membershipId: session.membership?.id ?? null,
    accessType: session.accessType,
    mode: session.mode,
    sessionType: session.sessionType,
  };
}

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
