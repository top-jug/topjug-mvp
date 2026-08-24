import { useLocation, useNavigate } from 'react-router';

export type AppScreen = 'home' | 'gymSearch' | 'myGyms' | 'detail' | 'calendar' | 'record' | 'records' | 'profile' | 'membership';
export type BottomTab = 'home' | 'gymSearch' | 'calendar';

export function getScreenPath(screen: AppScreen, gymId?: string) {
  switch (screen) {
    case 'home':
      return '/';
    case 'gymSearch':
      return '/gyms';
    case 'myGyms':
      return '/gyms/saved';
    case 'detail':
      return gymId ? `/gyms/${gymId}` : '/gyms';
    case 'calendar':
      return '/schedule/settings';
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

export function useNavigateBack(fallbackPath: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    if (location.key === 'default') {
      navigate(fallbackPath, { replace: true });
      return;
    }

    navigate(-1);
  };
}
