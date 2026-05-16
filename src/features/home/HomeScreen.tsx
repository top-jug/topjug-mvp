import { useState } from 'react';
import BottomTabBar from '../../app/components/layout/BottomTabBar';
import NotificationScreen from '../notifications/NotificationScreen';
import { useAppScreenNavigate } from '../../app/navigation';
import { HomeTopBar } from './components/HomeTopBar';
import { HomeCalendarGrid } from './components/HomeCalendarGrid';
import { HomeRecentGyms } from './components/HomeRecentGyms';
import { HomeMembership } from './components/HomeMembership';
import { HomeNearbyGyms } from './components/HomeNearbyGyms';

export default function HomeScreen() {
  const [showNotification, setShowNotification] = useState(false);
  const navigateToScreen = useAppScreenNavigate();

  return (
    <>
      <HomeTopBar onNotificationClick={() => setShowNotification(true)} onProfileClick={() => navigateToScreen('profile')} />

      <div className="px-5 overflow-y-auto hide-scrollbar pb-24 min-h-screen">
        <div className="mb-7">
          <HomeCalendarGrid onOpen={() => navigateToScreen('calendar')} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <HomeRecentGyms onGymClick={() => navigateToScreen('detail')} onOpen={() => navigateToScreen('calendar')} />
          <HomeMembership onOpen={() => navigateToScreen('membership')} />
        </div>

        <HomeNearbyGyms onGymClick={() => navigateToScreen('detail')} onOpen={() => navigateToScreen('gymSearch')} />

        <div className="h-2"></div>
      </div>

      <BottomTabBar activeTab="home" onNavigate={navigateToScreen} />

      {showNotification && <NotificationScreen onClose={() => setShowNotification(false)} />}
    </>
  );
}
