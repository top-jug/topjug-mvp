import { Navigate, useNavigate, useParams } from 'react-router';
import CalendarScreen from '../../features/calendar/CalendarScreen';
import { AppScreen, useAppScreenNavigate } from '../navigation';

export default function CalendarPage() {
  const navigate = useNavigate();
  const { calendarView } = useParams();
  const navigateToScreen = useAppScreenNavigate();
  const viewMode = calendarView === 'records' ? 'record' : calendarView === 'settings' ? 'setting' : null;

  if (!viewMode) return <Navigate to="/schedule/settings" replace />;

  return (
    <CalendarScreen
      viewMode={viewMode}
      onViewModeChange={(mode) => navigate(`/schedule/${mode === 'record' ? 'records' : 'settings'}`, { replace: true })}
      onNavigate={(screen) => navigateToScreen(screen as AppScreen)}
      onOpenRecord={(recordId) => navigate(`/records/${recordId}`)}
    />
  );
}
