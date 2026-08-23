import { useNavigate } from 'react-router';
import CalendarScreen from '../../features/calendar/CalendarScreen';
import { AppScreen, useAppScreenNavigate } from '../navigation';

export default function CalendarPage() {
  const navigate = useNavigate();
  const navigateToScreen = useAppScreenNavigate();

  return (
    <CalendarScreen
      onNavigate={(screen) => navigateToScreen(screen as AppScreen)}
      onOpenRecord={(recordId) => navigate(`/records/${recordId}`)}
    />
  );
}
