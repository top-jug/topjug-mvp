import BottomTabBar from '../../app/components/layout/BottomTabBar';
import { useAppScreenNavigate } from '../../app/navigation';
import { HomeTopBar } from './components/HomeTopBar';
import { HomeCalendarGrid } from './components/HomeCalendarGrid';
import { HomeRecentGyms } from './components/HomeRecentGyms';
import { HomeMembership } from './components/HomeMembership';
import { HomeNearbyGyms } from './components/HomeNearbyGyms';

export default function HomeScreen() {
  const navigateToScreen = useAppScreenNavigate();

  return (
    <>
      <HomeTopBar onProfileClick={() => navigateToScreen('profile')} />

      <main className="px-5 overflow-y-auto hide-scrollbar pb-24 min-h-screen">
        <div className="mb-7">
          <HomeCalendarGrid onOpen={() => navigateToScreen('calendar')} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <HomeRecentGyms onOpen={() => navigateToScreen('records')} />
          <HomeMembership onOpen={() => navigateToScreen('membership')} />
        </div>

        <HomeNearbyGyms onGymClick={(gymId) => navigateToScreen('detail', { gymId })} onOpen={() => navigateToScreen('gymSearch')} />

        <div className="h-2"></div>
      </main>

      <BottomTabBar activeTab="home" onNavigate={navigateToScreen} />
    </>
  );
}
