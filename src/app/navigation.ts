import { useNavigate } from 'react-router';

export type AppScreen = 'home' | 'gymSearch' | 'myGyms' | 'detail' | 'calendar' | 'record' | 'records' | 'profile' | 'membership';
export type BottomTab = 'home' | 'gymSearch' | 'calendar';

export const DEFAULT_GYM_ID = 'the-climb-yeonnam';

export function getScreenPath(screen: AppScreen, gymId = DEFAULT_GYM_ID) {
  switch (screen) {
    case 'home':
      return '/';
    case 'gymSearch':
      return '/gyms';
    case 'myGyms':
      return '/gyms/saved';
    case 'detail':
      return `/gyms/${gymId}`;
    case 'calendar':
      return '/schedule';
    case 'record':
      return '/record/start';
    case 'records':
      return '/records';
    case 'profile':
      return '/profile';
    case 'membership':
      return '/memberships';
  }
}

export function useAppScreenNavigate() {
  const navigate = useNavigate();

  return (screen: AppScreen, options?: { gymId?: string }) => {
    navigate(getScreenPath(screen, options?.gymId));
  };
}
