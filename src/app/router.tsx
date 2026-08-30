import { Navigate, Outlet, Route, Routes } from 'react-router';
import CalendarPage from './pages/CalendarPage';
import GymDetailPage from './pages/GymDetailPage';
import MembershipPage from './pages/MembershipPage';
import GymSearchPage from './pages/GymSearchPage';
import ProfilePage from './pages/ProfilePage';
import HomeScreen from '../features/home/HomeScreen';
import RecordStartPage from './pages/RecordStartPage';
import RecordPage from './pages/RecordPage';
import MyRecordsPage from './pages/MyRecordsPage';
import RecordResultPage from './pages/RecordResultPage';
import RecordSharePage from './pages/RecordSharePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import PublicRecordSharePage from './pages/PublicRecordSharePage';
import { RequireOperationsAdmin } from '../features/operations/RequireOperationsAdmin';
import { OperationsLayout } from '../features/operations/OperationsLayout';
import { OperationsDashboard } from '../features/operations/OperationsDashboard';
import { OperationsComingSoon } from '../features/operations/OperationsComingSoon';

function PreviewLayout() {
  return (
    <div className="mobile-screen bg-white">
      <Outlet />
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<RequireOperationsAdmin />}>
        <Route path="/ops" element={<OperationsLayout />}>
          <Route index element={<OperationsDashboard />} />
          <Route path="gyms" element={<OperationsComingSoon title="암장 관리" />} />
          <Route path="gym-tags" element={<OperationsComingSoon title="태그 관리" />} />
        </Route>
      </Route>
      <Route element={<PreviewLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/gyms" element={<GymSearchPage />} />
        <Route path="/gyms/:gymId" element={<GymDetailPage />} />
        <Route path="/schedule" element={<Navigate to="/schedule/settings" replace />} />
        <Route path="/schedule/:calendarView" element={<CalendarPage />} />
        <Route path="/shares/:token" element={<PublicRecordSharePage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/gyms/saved" element={<GymSearchPage initialView="saved" />} />
          <Route path="/record/start" element={<RecordStartPage />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/records" element={<MyRecordsPage />} />
          <Route path="/records/:recordId/share" element={<RecordSharePage />} />
          <Route path="/records/:recordId" element={<RecordResultPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/memberships" element={<MembershipPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
