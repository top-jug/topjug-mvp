import { useEffect, useMemo, useState } from 'react';
import { ApiClientError } from '../../app/api/api-client';
import { ApiGymDetail, displayGymName, getGym } from '../../app/api/gym-api';
import { useSavedGyms } from '../../app/providers/SavedGymsProvider';
import { GymFacility } from '../../entities/gym/types';
import GymDetailCarousel from './components/GymDetailCarousel';
import GymDetailHeader from './components/GymDetailHeader';
import GymDifficultySection from './components/GymDifficultySection';
import GymFacilitiesSection from './components/GymFacilitiesSection';
import GymInfoSection from './components/GymInfoSection';
import { buildGymMapLink } from './gym-detail-controls';
import {
  buildGymSettingCalendar,
  presentGymContacts,
  presentOperatingHourOverrides,
  presentWeeklyOperatingHours,
  selectGymDetailMediaPresentation,
  selectInitialGymSettingMonth,
  shiftGymSettingMonth,
  type GymSettingMonth,
} from './gym-presentation';

const FACILITIES: Record<string, GymFacility> = {
  shower: { label: '샤워실', icon: 'shower' },
  kilter_board: { label: '킬터보드', icon: 'boulder' },
  stretching_zone: { label: '스트레칭존', icon: 'stretch' },
  parking: { label: '주차가능', icon: 'parking' },
  shoe_rental: { label: '암벽화 대여', icon: 'rental' },
};

function detailErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.status === 404) return '암장을 찾을 수 없습니다.';
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return '암장 상세 정보를 불러오지 못했습니다.';
}

export default function GymDetailScreen({ gymId, onClose }: { gymId: string; onClose: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [gym, setGym] = useState<ApiGymDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState<GymSettingMonth | null>(null);
  const { isSavedGym, toggleSavedGym, pendingGymIds, getActionError, dismissActionError } = useSavedGyms();

  useEffect(() => () => dismissActionError(gymId), [dismissActionError, gymId]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setCalendarMonth(null);

    getGym(gymId, controller.signal)
      .then((response) => {
        setGym(response.data);
        setCalendarMonth(selectInitialGymSettingMonth(response.data.settingEvents));
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setGym(null);
        setError(detailErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [gymId, requestVersion]);

  const presentation = useMemo(() => {
    if (!gym) return null;
    const media = selectGymDetailMediaPresentation(gym);
    const focusMonth = calendarMonth ?? selectInitialGymSettingMonth(gym.settingEvents);
    const calendar = buildGymSettingCalendar(gym.settingEvents, focusMonth);

    return {
      title: displayGymName(gym),
      logoUrl: media.logoUrl,
      photos: media.photos,
      mapImage: media.locationMapImage,
      mapHref: buildGymMapLink(gym.latitude, gym.longitude),
      calendar,
      focusMonth,
      grades: gym.grades.map((grade) => ({ color: grade.color, label: grade.label })),
      facilities: gym.facilities.map((facility) => FACILITIES[facility]).filter((facility): facility is GymFacility => Boolean(facility)),
      weeklyHours: presentWeeklyOperatingHours(gym.operatingHours, gym.operatingHoursNote),
      operatingHourOverrides: presentOperatingHourOverrides(gym.operatingHourOverrides),
      contacts: presentGymContacts(gym),
      prices: gym.prices.map((price) => `${price.type === 'shoe_rental' ? '암벽화 대여' : '일일 이용권'} · ${price.rawText}`),
    };
  }, [calendarMonth, gym]);

  if (isLoading) {
    return <DetailState title="암장 상세" message="암장 정보를 불러오는 중입니다." onBack={onClose} />;
  }

  if (error || !gym || !presentation) {
    return <DetailState title="암장 상세" message={error ?? '암장 정보를 불러오지 못했습니다.'} onBack={onClose} onRetry={() => setRequestVersion((version) => version + 1)} />;
  }

  const isSaving = pendingGymIds.includes(gym.id);
  const actionError = getActionError(gym.id);

  return (
    <>
      <GymDetailHeader
        title={presentation.title}
        logoUrl={presentation.logoUrl}
        isFavorite={isSavedGym(gym.id)}
        onBack={onClose}
        onToggleFavorite={() => { if (!isSaving) void toggleSavedGym(gym).catch(() => undefined); }}
      />

      {actionError && (
        <div className="mx-5 mb-2 flex items-start justify-between gap-3 rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600" role="status">
          <span>{actionError.message}</span>
          <button type="button" onClick={() => dismissActionError(gym.id)} className="min-h-6 flex-shrink-0 font-bold">닫기</button>
        </div>
      )}

      <div className="overflow-y-auto pb-10 min-h-screen">
        <GymDetailCarousel
          currentSlide={currentSlide}
          photos={presentation.photos}
          mapImage={presentation.mapImage}
          mapHref={presentation.mapHref}
          mapLinkLabel={`카카오맵에서 ${presentation.title} 위치 보기`}
          calendarDays={presentation.calendar.days}
          eventDays={presentation.calendar.eventDays}
          monthLabel={presentation.calendar.monthLabel}
          onChangeEventMonth={(delta) => {
            setCalendarMonth(shiftGymSettingMonth(presentation.focusMonth, delta));
          }}
          onSlideChange={setCurrentSlide}
        />
        {presentation.grades.length > 0 && <GymDifficultySection grades={presentation.grades} />}
        <GymInfoSection
          address={gym.address}
          nearby={gym.nearbyDirections ?? ''}
          operationStatus={gym.operationStatus}
          operatingHours={presentation.weeklyHours.hours}
          operatingHoursNote={presentation.weeklyHours.note}
          operatingHourOverrides={presentation.operatingHourOverrides}
          prices={presentation.prices}
          parkingInfo={gym.parkingInfo}
          contacts={presentation.contacts}
        />
        {presentation.facilities.length > 0 && <GymFacilitiesSection facilities={presentation.facilities} />}
      </div>
    </>
  );
}

function DetailState({ title, message, onBack, onRetry }: { title: string; message: string; onBack: () => void; onRetry?: () => void }) {
  return (
    <div className="min-h-screen bg-white">
      <GymDetailHeader title={title} isFavorite={false} onBack={onBack} onToggleFavorite={() => undefined} />
      <div className="mx-5 mt-8 rounded-3xl border border-dashed border-neutral-300 px-6 py-12 text-center">
        <div className="text-[15px] font-bold text-neutral-900">{message}</div>
        {onRetry && <button onClick={onRetry} className="mt-4 rounded-full bg-blue-500 px-4 py-2 text-[13px] font-semibold text-white">다시 시도</button>}
      </div>
    </div>
  );
}
