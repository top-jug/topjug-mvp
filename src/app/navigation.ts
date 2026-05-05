import { useNavigate } from 'react-router';

export type AppScreen = 'home' | 'gymSearch' | 'detail' | 'calendar' | 'record' | 'profile' | 'membership';
export type BottomTab = 'home' | 'gymSearch' | 'calendar';

export const DEFAULT_GYM_ID = 'the-climb-yeonnam';

export function getScreenPath(screen: AppScreen, gymId = DEFAULT_GYM_ID) {
  switch (screen) {
    case 'home':
      return '/';
    case 'gymSearch':
      return '/gyms';
    case 'detail':
      return `/gyms/${gymId}`;
    case 'calendar':
      return '/schedule';
    case 'record':
      return '/record/start';
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
