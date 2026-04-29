import CalendarScreen from '../../features/calendar/CalendarScreen';
import { AppScreen, useAppScreenNavigate } from '../navigation';

export default function CalendarPage() {
  const navigateToScreen = useAppScreenNavigate();

  return <CalendarScreen onNavigate={(screen) => navigateToScreen(screen as AppScreen)} />;
}
