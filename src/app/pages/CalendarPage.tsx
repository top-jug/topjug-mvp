import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import CalendarScreen from '../../features/calendar/CalendarScreen';
import { useAuth } from '../../features/auth/AuthProvider';
import { AppScreen, useAppScreenNavigate } from '../navigation';

export default function CalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { calendarView } = useParams();
  const { status: authStatus } = useAuth();
  const navigateToScreen = useAppScreenNavigate();
  const viewMode = calendarView === 'records' ? 'record' : calendarView === 'settings' ? 'setting' : null;

  if (!viewMode) return <Navigate to="/schedule/settings" replace />;
  if (viewMode === 'record' && authStatus === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return (
    <CalendarScreen
      viewMode={viewMode}
      onViewModeChange={(mode) => navigate(`/schedule/${mode === 'record' ? 'records' : 'settings'}`, { replace: true })}
      onNavigate={(screen) => navigateToScreen(screen as AppScreen)}
      onOpenGym={(gymId) => navigate(`/gyms/${gymId}`)}
      onOpenRecord={(recordId) => navigate(`/records/${recordId}`)}
    />
  );
}
