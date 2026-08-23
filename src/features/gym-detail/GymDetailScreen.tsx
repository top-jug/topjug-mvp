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

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
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

function calendarFor(gym: ApiGymDetail) {
  const eventDates = gym.settingEvents.map((event) => new Date(event.startsAt)).filter((date) => !Number.isNaN(date.getTime()));
  const focus = eventDates[0] ?? new Date();
  const year = focus.getFullYear();
  const month = focus.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const days: Array<number | ''> = [
    ...Array.from({ length: firstDay }, () => '' as const),
    ...Array.from({ length: lastDate }, (_, index) => index + 1),
  ];
  while (days.length % 7 !== 0) days.push('');

  return {
    days,
    eventDays: eventDates
      .filter((date) => date.getFullYear() === year && date.getMonth() === month)
      .map((date) => date.getDate()),
    monthLabel: `${year}년 ${month + 1}월`,
  };
}

function operatingHoursFor(gym: ApiGymDetail) {
  if (gym.operatingHoursNote) return gym.operatingHoursNote.split('\n').filter(Boolean);
  if (gym.operatingHours.length === 0) return ['운영시간 정보가 없습니다.'];

  return gym.operatingHours.map((hours) => {
    const day = DAY_LABELS[hours.dayOfWeek] ?? `${hours.dayOfWeek}`;
    if (hours.isClosed) return `${day}요일 휴무`;
    return `${day}요일 ${hours.opensAt?.slice(0, 5) ?? '-'} - ${hours.closesAt?.slice(0, 5) ?? '-'}`;
  });
}

export default function GymDetailScreen({ gymId, onClose }: { gymId: string; onClose: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [gym, setGym] = useState<ApiGymDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const { isSavedGym, toggleSavedGym, pendingGymIds, actionError } = useSavedGyms();

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getGym(gymId, controller.signal)
      .then((response) => setGym(response.data))
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
    const logo = gym.media.find((media) => media.type === 'logo');
    const cover = gym.media.find((media) => media.type === 'cover') ?? gym.cover;
    const photos = gym.media.filter((media) => media.type === 'photo' && media.url).map((media) => media.url!);
    const photoFallback = cover?.url ?? logo?.url;
    const mapImage = gym.media.find((media) => media.type === 'map' && media.url)?.url
      ?? gym.walls.find((wall) => wall.mapMedia?.url)?.mapMedia?.url
      ?? null;
    const calendar = calendarFor(gym);

    return {
      title: displayGymName(gym),
      logoUrl: logo?.url ?? null,
      photos: photos.length > 0 ? photos : photoFallback ? [photoFallback] : [],
      mapImage,
      calendar,
      grades: gym.grades.map((grade) => ({ color: grade.color, label: grade.label })),
      facilities: gym.facilities.map((facility) => FACILITIES[facility]).filter((facility): facility is GymFacility => Boolean(facility)),
      hours: operatingHoursFor(gym),
      prices: gym.prices.map((price) => `${price.type === 'shoe_rental' ? '암벽화 대여' : '일일 이용권'} · ${price.rawText}`),
    };
  }, [gym]);

  if (isLoading) {
    return <DetailState title="암장 상세" message="암장 정보를 불러오는 중입니다." onBack={onClose} />;
  }

  if (error || !gym || !presentation) {
    return <DetailState title="암장 상세" message={error ?? '암장 정보를 불러오지 못했습니다.'} onBack={onClose} onRetry={() => setRequestVersion((version) => version + 1)} />;
  }

  const isSaving = pendingGymIds.includes(gym.id);

  return (
    <>
      <GymDetailHeader
        title={presentation.title}
        logoUrl={presentation.logoUrl}
        isFavorite={isSavedGym(gym.id)}
        onBack={onClose}
        onToggleFavorite={() => { if (!isSaving) void toggleSavedGym(gym).catch(() => undefined); }}
      />

      {actionError && <div className="mx-5 mb-2 rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600" role="status">{actionError}</div>}

      <div className="overflow-y-auto pb-10 min-h-screen">
        <GymDetailCarousel
          currentSlide={currentSlide}
          photos={presentation.photos}
          mapImage={presentation.mapImage}
          calendarDays={presentation.calendar.days}
          eventDays={presentation.calendar.eventDays}
          monthLabel={presentation.calendar.monthLabel}
          onSlideChange={setCurrentSlide}
        />
        {presentation.grades.length > 0 && <GymDifficultySection grades={presentation.grades} />}
        <GymInfoSection address={gym.address} nearby={gym.nearbyDirections ?? ''} operatingHours={presentation.hours} prices={presentation.prices} />
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
