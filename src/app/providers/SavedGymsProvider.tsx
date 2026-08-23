import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiClientError } from '../api/api-client';
import { ApiGymSummary, listSavedGyms, saveGym, unsaveGym } from '../api/gym-api';

interface SavedGymsContextValue {
  savedGyms: ApiGymSummary[];
  savedGymIds: string[];
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  pendingGymIds: string[];
  isSavedGym: (gymId: string) => boolean;
  refreshSavedGyms: () => Promise<void>;
  toggleSavedGym: (gym: ApiGymSummary) => Promise<void>;
}

const SavedGymsContext = createContext<SavedGymsContextValue | null>(null);

function savedGymErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.status === 401) return '로그인 후 내 암장을 이용할 수 있어요.';
  if (error instanceof Error) return error.message;
  return '내 암장 정보를 불러오지 못했습니다.';
}

export function SavedGymsProvider({ children }: PropsWithChildren) {
  const [savedGyms, setSavedGyms] = useState<ApiGymSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingGymIds, setPendingGymIds] = useState<string[]>([]);

  const refreshSavedGyms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setActionError(null);

    try {
      const response = await listSavedGyms();
      setSavedGyms(response.data);
    } catch (requestError) {
      setSavedGyms([]);
      setError(savedGymErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSavedGyms();
  }, [refreshSavedGyms]);

  const value = useMemo<SavedGymsContextValue>(() => {
    const savedGymIds = savedGyms.map((gym) => gym.id);

    return {
      savedGyms,
      savedGymIds,
      isLoading,
      error,
      actionError,
      pendingGymIds,
      isSavedGym: (gymId: string) => savedGymIds.includes(gymId),
      refreshSavedGyms,
      toggleSavedGym: async (gym: ApiGymSummary) => {
        if (pendingGymIds.includes(gym.id)) return;

        const wasSaved = savedGymIds.includes(gym.id);
        setActionError(null);
        setPendingGymIds((current) => [...current, gym.id]);
        setSavedGyms((current) => wasSaved
          ? current.filter((item) => item.id !== gym.id)
          : [gym, ...current]);

        try {
          if (wasSaved) await unsaveGym(gym.id);
          else await saveGym(gym.id);
        } catch (requestError) {
          setSavedGyms((current) => wasSaved
            ? [gym, ...current.filter((item) => item.id !== gym.id)]
            : current.filter((item) => item.id !== gym.id));
          const message = savedGymErrorMessage(requestError);
          setActionError(message);
          throw new Error(message);
        } finally {
          setPendingGymIds((current) => current.filter((id) => id !== gym.id));
        }
      },
    };
  }, [actionError, error, isLoading, pendingGymIds, refreshSavedGyms, savedGyms]);

  return <SavedGymsContext.Provider value={value}>{children}</SavedGymsContext.Provider>;
}

export function useSavedGyms() {
  const context = useContext(SavedGymsContext);

  if (!context) throw new Error('useSavedGyms must be used within SavedGymsProvider');
  return context;
}
