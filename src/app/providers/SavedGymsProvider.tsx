import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { GYM_SEARCH_ITEMS } from '../../mocks/gym-search';

interface SavedGymsContextValue {
  savedGymIds: number[];
  isSavedGym: (gymId: number) => boolean;
  toggleSavedGym: (gymId: number) => void;
}

const SavedGymsContext = createContext<SavedGymsContextValue | null>(null);
const STORAGE_KEY = 'topjug.savedGyms';
const INITIAL_SAVED_IDS = GYM_SEARCH_ITEMS.slice(0, 3).map((gym) => gym.id);

export function SavedGymsProvider({ children }: PropsWithChildren) {
  const [savedGymIds, setSavedGymIds] = useState<number[]>(() => {
    if (typeof window === 'undefined') return INITIAL_SAVED_IDS;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return INITIAL_SAVED_IDS;

    try {
      return JSON.parse(stored) as number[];
    } catch {
      return INITIAL_SAVED_IDS;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedGymIds));
  }, [savedGymIds]);

  const value = useMemo<SavedGymsContextValue>(() => {
    return {
      savedGymIds,
      isSavedGym: (gymId: number) => savedGymIds.includes(gymId),
      toggleSavedGym: (gymId: number) => {
        setSavedGymIds((current) => (current.includes(gymId) ? current.filter((id) => id !== gymId) : [...current, gymId]));
      },
    };
  }, [savedGymIds]);

  return <SavedGymsContext.Provider value={value}>{children}</SavedGymsContext.Provider>;
}

export function useSavedGyms() {
  const context = useContext(SavedGymsContext);

  if (!context) {
    throw new Error('useSavedGyms must be used within SavedGymsProvider');
  }

  return context;
}
