import GymDetailScreen from '../../features/gym-detail/GymDetailScreen';
import { AppScreen, useAppScreenNavigate, useNavigateBack } from '../navigation';

export default function GymDetailPage() {
  const navigateBack = useNavigateBack('/gyms');
  const navigateToScreen = useAppScreenNavigate();

  return <GymDetailScreen onClose={navigateBack} onNavigate={(screen) => navigateToScreen(screen as AppScreen)} />;
}
