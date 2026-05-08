import { useState } from 'react';
import TopTabHeader from '../../app/components/layout/TopTabHeader';
import BottomTabBar from '../../app/components/layout/BottomTabBar';
import { GYM_SEARCH_ITEMS, GYM_SEARCH_REGIONS, GYM_SEARCH_SUB_REGIONS, GYM_SEARCH_TABS } from '../../mocks/gym-search';
import GymSearchInput from './components/GymSearchInput';
import GymSearchList from './components/GymSearchList';
import GymSearchTabs from './components/GymSearchTabs';
import RegionFilterModal from './components/modals/RegionFilterModal';

export default function GymSearchScreen({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [activeView, setActiveView] = useState<'search' | 'saved'>('search');
  const [selectedTab, setSelectedTab] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegionFilter, setShowRegionFilter] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('서울');
  const [selectedSubRegion, setSelectedSubRegion] = useState<string | null>(null);
  const [showSubRegion, setShowSubRegion] = useState(false);

  const savedGyms = GYM_SEARCH_ITEMS.slice(0, 3);

  return (
    <>
      <TopTabHeader
        tabs={[
          { value: 'search', label: '검색' },
          { value: 'saved', label: '내 암장' },
        ]}
        activeTab={activeView}
        onChangeTab={(tab) => setActiveView(tab as 'search' | 'saved')}
        containerClassName="px-5 pt-5 pb-3 bg-white border-b border-neutral-100"
      />

      {activeView === 'search' ? (
        <>
          <div className="sticky top-0 z-20 bg-white border-b border-neutral-100">
            <GymSearchInput value={searchQuery} onChange={setSearchQuery} />

            <GymSearchTabs
              selectedTab={selectedTab}
              tabs={GYM_SEARCH_TABS}
              regionLabel={selectedSubRegion || selectedRegion}
              onSelectTab={setSelectedTab}
              onOpenRegion={() => setShowRegionFilter(true)}
            />
          </div>

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

          <GymSearchList gyms={GYM_SEARCH_ITEMS} onSelectGym={() => onNavigate('detail')} title="암장" showMapButton />
        </>
      ) : (
        <div className="relative">
          <GymSearchList gyms={savedGyms} onSelectGym={() => onNavigate('detail')} title="내 암장" />
          <div className="absolute top-3 right-5 z-10">
            <button className="text-[13px] text-neutral-500 font-medium px-3 py-1.5 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors">
              순서 편집
            </button>
          </div>
        </div>
      )}

      <BottomTabBar activeTab="gymSearch" onNavigate={onNavigate} />
    </>
  );
}
