import { UIEvent, useRef } from 'react';
import { ImageWithFallback } from '../../../app/components/figma/ImageWithFallback';

interface GymDetailCarouselProps {
  currentSlide: number;
  photos: string[];
  mapImage?: string | null;
  calendarDays: Array<number | ''>;
  eventDays?: number[];
  monthLabel?: string;
  onChangeEventMonth?: (delta: -1 | 1) => void;
  onSlideChange: (index: number) => void;
}

const SLIDE_TITLES = ['암장캘린더', '암장 사진', '지도'];

export default function GymDetailCarousel({ currentSlide, photos, mapImage, calendarDays, eventDays = [], monthLabel = '세팅 일정', onChangeEventMonth, onSlideChange }: GymDetailCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    if (container.clientWidth === 0) return;

    const nextSlide = Math.max(0, Math.min(SLIDE_TITLES.length - 1, Math.round(container.scrollLeft / container.clientWidth)));
    if (nextSlide !== currentSlide) onSlideChange(nextSlide);
  };

  return (
    <div className="px-5 mb-4">
      <div className="mb-2 mt-2 flex items-center justify-between px-0 py-3">
        <h2 className="text-[18px] font-bold text-neutral-900">{SLIDE_TITLES[currentSlide]}</h2>
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex w-full snap-x snap-mandatory overflow-x-auto rounded-2xl select-none touch-pan-x cursor-grab active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
          <div className="w-full flex-shrink-0 snap-center min-h-[300px] bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-4 relative flex flex-col">
            <div className="mb-4 flex min-h-11 items-center justify-center gap-3 text-center">
              <button
                type="button"
                onClick={() => onChangeEventMonth?.(-1)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[20px] font-medium text-neutral-700 shadow-sm"
                aria-label="이전 달"
              >
                ‹
              </button>
              <h3 className="text-[18px] font-bold text-neutral-900">{monthLabel}</h3>
              <button
                type="button"
                onClick={() => onChangeEventMonth?.(1)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[20px] font-medium text-neutral-700 shadow-sm"
                aria-label="다음 달"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center flex-1 items-center">
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <div key={day} className="text-[13px] font-medium text-neutral-500 py-1">{day}</div>
              ))}
              {calendarDays.map((date, i) => (
                <div
                  key={`${date}-${i}`}
                  className={`text-[14px] py-2.5 flex items-center justify-center mx-auto w-8 h-8 ${
                    typeof date === 'number' && eventDays.includes(date)
                      ? 'bg-blue-500 text-white rounded-full font-bold'
                      : date
                        ? 'text-neutral-700'
                        : 'text-transparent'
                  }`}
                >
                  {date}
                </div>
              ))}
            </div>
          </div>

          <div className="w-full flex-shrink-0 snap-center rounded-2xl bg-white border border-neutral-200 p-3 min-h-[300px]">
            <div className="grid grid-cols-[1.5fr_1fr] gap-3 h-full min-h-[276px]">
              <div className="rounded-2xl overflow-hidden bg-neutral-100">
                {photos[0] ? <ImageWithFallback src={photos[0]} alt="암장 대표 사진" className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center text-[13px] text-neutral-400">등록된 사진이 없습니다.</div>}
              </div>
              <div className="grid grid-rows-2 gap-3">
                {photos.slice(1, 3).map((photo, index) => (
                  <div key={photo} className="rounded-2xl overflow-hidden relative">
                    <ImageWithFallback src={photo} alt={`Gym Photo ${index + 2}`} className="w-full h-full object-cover" />
                    {index === 1 && photos.length > 3 && (
                      <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-white text-[18px] font-bold">
                        +{photos.length - 3}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full flex-shrink-0 snap-center min-h-[300px] bg-gradient-to-br from-blue-50 via-green-50 to-blue-100 rounded-2xl relative overflow-hidden">
            {mapImage ? <ImageWithFallback src={mapImage} alt="암장 지도" className="w-full h-full object-cover opacity-40" /> : <div className="absolute inset-0 flex items-start justify-center pt-16 text-[13px] text-neutral-500">등록된 지도 이미지가 없습니다.</div>}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="w-14 h-14 bg-blue-400 rounded-full opacity-30 animate-ping absolute"></div>
                <div className="w-14 h-14 bg-blue-500 rounded-full border-4 border-white shadow-lg relative flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <button className="absolute top-3 right-3 w-11 h-11 bg-white rounded-lg flex items-center justify-center shadow-md">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>

            <button className="absolute bottom-3 right-3 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
            </button>

            <button className="absolute bottom-3 left-3 min-h-11 bg-white rounded-full px-4 py-2 shadow-md flex items-center gap-1.5">
              <div className="flex gap-0.5">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              </div>
              <span className="text-[12px] font-medium">MAP APPS</span>
            </button>
          </div>
      </div>

      <div className="flex justify-center gap-1.5 mt-3 mb-4">
        {SLIDE_TITLES.map((title, index) => (
          <div key={title} className={`w-1.5 h-1.5 rounded-full transition-colors ${currentSlide === index ? 'bg-blue-500' : 'bg-neutral-300'}`} />
        ))}
      </div>
    </div>
  );
}
