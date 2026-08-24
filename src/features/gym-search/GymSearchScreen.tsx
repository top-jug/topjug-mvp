import { useEffect, useMemo, useState } from 'react';
import { ApiClientError } from '../../app/api/api-client';
import { ApiGymSummary, listGyms } from '../../app/api/gym-api';
import BottomTabBar from '../../app/components/layout/BottomTabBar';
import TopTabHeader from '../../app/components/layout/TopTabHeader';
import { useSavedGyms } from '../../app/providers/SavedGymsProvider';
import { ALL_GYM_REGIONS, GYM_SEARCH_REGIONS, GYM_SEARCH_TABS, gymMatchesRegion } from './gym-search-options';
import GymSearchInput from './components/GymSearchInput';
import GymSearchList from './components/GymSearchList';
import GymSearchTabs from './components/GymSearchTabs';
import RegionFilterModal from './components/modals/RegionFilterModal';
import { shouldClearSavedGymErrorsOnViewChange } from './saved-gym-action-state';

const PAGE_SIZE = 10;
const FACILITY_CODES: Record<string, string> = {
  샤워실: 'shower',
  킬터보드: 'kilter_board',
  스트레칭: 'stretching_zone',
  주차가능: 'parking',
};

interface GymSearchScreenProps {
  initialView?: 'search' | 'saved';
  onNavigate: (screen: string, gymId?: string) => void;
}

function listErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return '암장 목록을 불러오지 못했습니다.';
}

export default function GymSearchScreen({ initialView = 'search', onNavigate }: GymSearchScreenProps) {
  const [activeView, setActiveView] = useState<'search' | 'saved'>(initialView);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegionFilter, setShowRegionFilter] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(ALL_GYM_REGIONS);
  const [gyms, setGyms] = useState<ApiGymSummary[]>([]);
  const [isLoadingGyms, setIsLoadingGyms] = useState(true);
  const [gymError, setGymError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const {
    savedGyms,
    isLoading: isLoadingSavedGyms,
    error: savedGymsError,
    getActionError,
    dismissActionError,
    pendingGymIds,
    isSavedGym,
    refreshSavedGyms,
    toggleSavedGym,
  } = useSavedGyms();

  useEffect(() => () => dismissActionError(), [dismissActionError]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoadingGyms(true);
      setGymError(null);

      try {
        const response = await listGyms({
          q: searchQuery.trim() || undefined,
          facility: selectedTabs[0] ? FACILITY_CODES[selectedTabs[0]] : undefined,
          limit: 100,
          signal: controller.signal,
        });
        setGyms(response.data);
        setVisibleCount(PAGE_SIZE);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setGyms([]);
        setGymError(listErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) setIsLoadingGyms(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [requestVersion, searchQuery, selectedTabs]);

  const filteredGyms = useMemo(() => gyms.filter((gym) => {
    const matchesFacilities = selectedTabs.every((tab) => gym.facilities.includes(FACILITY_CODES[tab]));
    return gymMatchesRegion(gym, selectedRegion) && matchesFacilities;
  }), [gyms, selectedRegion, selectedTabs]);

  const visibleGyms = filteredGyms.slice(0, visibleCount);

  const handleSelectTab = (tab: string) => {
    setVisibleCount(PAGE_SIZE);
    if (tab === '전체') {
      setSelectedTabs([]);
      return;
    }
    setSelectedTabs((current) => current.includes(tab) ? current.filter((item) => item !== tab) : [...current, tab]);
  };

  const handleChangeView = (view: 'search' | 'saved') => {
    if (shouldClearSavedGymErrorsOnViewChange(activeView, view)) dismissActionError();
    setActiveView(view);
    if (view === 'saved') void refreshSavedGyms();
  };

  const handleToggleSavedGym = (gym: ApiGymSummary) => {
    void toggleSavedGym(gym).catch(() => undefined);
  };

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-neutral-100 bg-white">
        <TopTabHeader
          tabs={[{ value: 'search', label: '검색' }, { value: 'saved', label: '내 암장' }]}
          activeTab={activeView}
          onChangeTab={handleChangeView}
          containerClassName="px-5 pt-5 pb-2 bg-white"
        />

        {activeView === 'search' && (
          <>
            <GymSearchInput value={searchQuery} onChange={setSearchQuery} />
            <GymSearchTabs
              selectedTabs={selectedTabs}
              tabs={GYM_SEARCH_TABS}
              regionLabel={selectedRegion}
              onSelectTab={handleSelectTab}
              onOpenRegion={() => setShowRegionFilter(true)}
            />
          </>
        )}
      </div>

      <main>
        {activeView === 'search' ? (
          <>
            {showRegionFilter && (
              <RegionFilterModal
                selectedRegion={selectedRegion}
                regions={GYM_SEARCH_REGIONS}
                onClose={() => setShowRegionFilter(false)}
                onSelectRegion={(region) => {
                  setVisibleCount(PAGE_SIZE);
                  setSelectedRegion(region);
                  setShowRegionFilter(false);
                }}
              />
            )}
            <GymSearchList
              gyms={visibleGyms}
              onSelectGym={(gym) => onNavigate('detail', gym.id)}
              title="암장"
              countOverride={filteredGyms.length}
              countLabel={`불러온 검색 결과 ${filteredGyms.length}개`}
              isSavedGym={isSavedGym}
              onToggleSavedGym={handleToggleSavedGym}
              isSavingGym={(gymId) => pendingGymIds.includes(gymId)}
              getActionError={getActionError}
              onDismissActionError={dismissActionError}
              isLoading={isLoadingGyms}
              error={gymError}
              onRetry={() => setRequestVersion((version) => version + 1)}
              hasMore={visibleCount < filteredGyms.length}
              onLoadMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
            />
          </>
        ) : (
          <GymSearchList
            gyms={savedGyms}
            onSelectGym={(gym) => onNavigate('detail', gym.id)}
            title="내 암장"
            isSavedGym={isSavedGym}
            onToggleSavedGym={handleToggleSavedGym}
            isSavingGym={(gymId) => pendingGymIds.includes(gymId)}
            getActionError={getActionError}
            onDismissActionError={dismissActionError}
            isLoading={isLoadingSavedGyms}
            error={savedGymsError}
            emptyMessage="저장한 암장이 없어요."
            onRetry={() => void refreshSavedGyms()}
          />
        )}
      </main>

      <BottomTabBar activeTab="gymSearch" onNavigate={onNavigate} />
    </>
  );
}
