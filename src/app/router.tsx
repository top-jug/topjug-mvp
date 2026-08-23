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
import PublicRecordSharePage from './pages/PublicRecordSharePage';

function PreviewLayout() {
  return (
    <div className="min-h-screen bg-white">
      <Outlet />
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PreviewLayout />}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/gyms" element={<GymSearchPage />} />
        <Route path="/gyms/saved" element={<GymSearchPage initialView="saved" />} />
        <Route path="/gyms/:gymId" element={<GymDetailPage />} />
        <Route path="/schedule" element={<Navigate to="/schedule/settings" replace />} />
        <Route path="/schedule/:calendarView" element={<CalendarPage />} />
        <Route path="/record/start" element={<RecordStartPage />} />
        <Route path="/record" element={<RecordPage />} />
        <Route path="/records" element={<MyRecordsPage />} />
        <Route path="/records/:recordId/share" element={<RecordSharePage />} />
        <Route path="/records/:recordId" element={<RecordResultPage />} />
        <Route path="/shares/:token" element={<PublicRecordSharePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/memberships" element={<MembershipPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
