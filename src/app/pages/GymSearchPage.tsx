import GymSearchScreen from '../../features/gym-search/GymSearchScreen';
import { AppScreen, useAppScreenNavigate } from '../navigation';

export default function GymSearchPage() {
  const navigateToScreen = useAppScreenNavigate();

  return <GymSearchScreen onNavigate={(screen) => navigateToScreen(screen as AppScreen)} />;
}
