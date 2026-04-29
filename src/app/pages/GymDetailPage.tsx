import { useNavigate } from 'react-router';
import GymDetailScreen from '../../features/gym-detail/GymDetailScreen';
import { AppScreen, DEFAULT_GYM_ID, useAppScreenNavigate } from '../navigation';

export default function GymDetailPage() {
  const navigate = useNavigate();
  const navigateToScreen = useAppScreenNavigate();

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/gyms', { replace: true });
  };

  return <GymDetailScreen onClose={handleClose} onNavigate={(screen) => navigateToScreen(screen as AppScreen)} />;
}
