import GymSearchScreen from '../../features/gym-search/GymSearchScreen';
import { AppScreen, useAppScreenNavigate } from '../navigation';

interface GymSearchPageProps {
  initialView?: 'search' | 'saved';
}

export default function GymSearchPage({ initialView = 'search' }: GymSearchPageProps) {
  const navigateToScreen = useAppScreenNavigate();

  return <GymSearchScreen initialView={initialView} onNavigate={(screen, gymId) => navigateToScreen(screen as AppScreen, { gymId })} />;
}
