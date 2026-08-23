import { useMemo, useState } from 'react';
import TopTabHeader from '../../app/components/layout/TopTabHeader';
import BottomTabBar from '../../app/components/layout/BottomTabBar';
import { useSavedGyms } from '../../app/providers/SavedGymsProvider';
import { GYM_SEARCH_ITEMS, GYM_SEARCH_REGIONS, GYM_SEARCH_SUB_REGIONS, GYM_SEARCH_TABS } from '../../mocks/gym-search';
import GymSearchInput from './components/GymSearchInput';
import GymSearchList from './components/GymSearchList';
import GymSearchTabs from './components/GymSearchTabs';
import RegionFilterModal from './components/modals/RegionFilterModal';

interface GymSearchScreenProps {
  initialView?: 'search' | 'saved';
  onNavigate: (screen: string) => void;
}

export default function GymSearchScreen({ initialView = 'search', onNavigate }: GymSearchScreenProps) {
  const [activeView, setActiveView] = useState<'search' | 'saved'>(initialView);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegionFilter, setShowRegionFilter] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('서울');
  const [selectedSubRegion, setSelectedSubRegion] = useState<string | null>(null);
  const [showSubRegion, setShowSubRegion] = useState(false);
  const { savedGymIds, isSavedGym, toggleSavedGym } = useSavedGyms();
  const [visibleSavedGymIds, setVisibleSavedGymIds] = useState(savedGymIds);
  const [savedCountSnapshot, setSavedCountSnapshot] = useState(savedGymIds.length);

  const savedGyms = useMemo(() => GYM_SEARCH_ITEMS.filter((gym) => visibleSavedGymIds.includes(gym.id)), [visibleSavedGymIds]);

  const handleSelectTab = (tab: string) => {
    if (tab === '전체') {
      setSelectedTabs([]);
      return;
    }

    setSelectedTabs((current) => (current.includes(tab) ? current.filter((item) => item !== tab) : [...current, tab]));
  };

  const handleChangeView = (tab: 'search' | 'saved') => {
    if (tab === 'saved') {
      setVisibleSavedGymIds(savedGymIds);
      setSavedCountSnapshot(savedGymIds.length);
    }

    setActiveView(tab);
  };

  return (
    <>
      <div className="sticky top-0 z-20 bg-white border-b border-neutral-100">
        <TopTabHeader
          tabs={[
            { value: 'search', label: '검색' },
            { value: 'saved', label: '내 암장' },
          ]}
          activeTab={activeView}
          onChangeTab={handleChangeView}
          containerClassName="px-5 pt-5 pb-3 bg-white"
        />

        {activeView === 'search' && (
          <>
            <GymSearchInput value={searchQuery} onChange={setSearchQuery} />

            <GymSearchTabs
              selectedTabs={selectedTabs}
              tabs={GYM_SEARCH_TABS}
              regionLabel={selectedSubRegion || selectedRegion}
              onSelectTab={handleSelectTab}
              onOpenRegion={() => setShowRegionFilter(true)}
            />
          </>
        )}
      </div>

      {activeView === 'search' ? (
        <>
          {showRegionFilter && (
            <RegionFilterModal
              showSubRegion={showSubRegion}
              selectedRegion={selectedRegion}
              selectedSubRegion={selectedSubRegion}
              regions={GYM_SEARCH_REGIONS}
              subRegions={GYM_SEARCH_SUB_REGIONS}
              onBack={() => setShowSubRegion(false)}
              onClose={() => {
                setShowRegionFilter(false);
                setShowSubRegion(false);
              }}
              onSelectRegion={(region) => {
                if (GYM_SEARCH_SUB_REGIONS[region]) {
                  setSelectedRegion(region);
                  setSelectedSubRegion(null);
                  setShowSubRegion(true);
                } else {
                  setSelectedRegion(region);
                  setSelectedSubRegion(null);
                  setShowRegionFilter(false);
                }
              }}
              onSelectSubRegion={(subRegion) => {
                setSelectedSubRegion(subRegion);
                setShowRegionFilter(false);
                setShowSubRegion(false);
              }}
            />
          )}

          <GymSearchList
            gyms={GYM_SEARCH_ITEMS}
            onSelectGym={() => onNavigate('detail')}
            title="암장"
            isSavedGym={isSavedGym}
            onToggleSavedGym={toggleSavedGym}
            showMapButton
          />
        </>
      ) : (
        <GymSearchList
          gyms={savedGyms}
          onSelectGym={() => onNavigate('detail')}
          title="내 암장"
          isSavedGym={isSavedGym}
          onToggleSavedGym={toggleSavedGym}
          countOverride={savedCountSnapshot}
        />
      )}

      <BottomTabBar activeTab="gymSearch" onNavigate={onNavigate} />
    </>
  );
}
