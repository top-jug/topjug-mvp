import { type KeyboardEvent, type UIEvent, useEffect, useId, useRef } from 'react';
import { ImageWithFallback } from '../../../app/components/figma/ImageWithFallback';
import {
  carouselNavigationAvailability,
  carouselSlideForKey,
  clampCarouselSlide,
  GYM_DETAIL_SLIDE_TITLES,
  gymDetailSlideLabel,
  isHorizontalArrowKey,
  shouldSyncCarouselScroll,
  shouldTransferCarouselFocus,
} from '../gym-detail-controls';

interface GymDetailCarouselProps {
  currentSlide: number;
  photos: string[];
  mapImage?: string | null;
  mapHref?: string | null;
  mapLinkLabel?: string;
  calendarDays: Array<number | ''>;
  eventDays?: number[];
  monthLabel?: string;
  onChangeEventMonth?: (delta: -1 | 1) => void;
  onSlideChange: (index: number) => void;
}

export default function GymDetailCarousel({ currentSlide, photos, mapImage, mapHref, mapLinkLabel = '카카오맵에서 암장 위치 보기', calendarDays, eventDays = [], monthLabel = '세팅 일정', onChangeEventMonth, onSlideChange }: GymDetailCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const slideControlRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const programmaticScrollTargetRef = useRef<number | null>(null);
  const carouselId = useId();
  const slideCount = GYM_DETAIL_SLIDE_TITLES.length;
  const activeSlide = clampCarouselSlide(currentSlide, slideCount);
  const navigation = carouselNavigationAvailability(activeSlide, slideCount);

  useEffect(() => {
    if (programmaticScrollTargetRef.current === activeSlide) {
      programmaticScrollTargetRef.current = null;
    }
  }, [activeSlide]);

  const changeSlide = (index: number) => {
    const nextSlide = clampCarouselSlide(index, slideCount);
    if (nextSlide === activeSlide) return;

    const focusIsWithinCurrentSlide = slideRefs.current[activeSlide]?.contains(document.activeElement) ?? false;
    if (shouldTransferCarouselFocus(activeSlide, nextSlide, focusIsWithinCurrentSlide)) {
      slideControlRefs.current[nextSlide]?.focus();
    }
    onSlideChange(nextSlide);
  };

  const selectSlide = (index: number) => {
    const nextSlide = clampCarouselSlide(index, slideCount);
    if (nextSlide === activeSlide) return;

    const slide = scrollerRef.current?.children[nextSlide] as HTMLElement | undefined;
    programmaticScrollTargetRef.current = nextSlide;
    scrollerRef.current?.scrollTo({ left: slide?.offsetLeft ?? 0, behavior: 'auto' });
    changeSlide(nextSlide);
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    if (container.clientWidth === 0) return;

    const nextSlide = clampCarouselSlide(Math.round(container.scrollLeft / container.clientWidth), slideCount);
    if (!shouldSyncCarouselScroll(nextSlide, programmaticScrollTargetRef.current)) return;
    programmaticScrollTargetRef.current = null;
    changeSlide(nextSlide);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Calendar month controls own their keyboard events even though they live in the scroller.
    if (event.target !== event.currentTarget) return;
    const nextSlide = carouselSlideForKey(event.key, activeSlide, slideCount);
    if (nextSlide === null) return;
    event.preventDefault();
    selectSlide(nextSlide);
  };

  const handleMonthControlKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isHorizontalArrowKey(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <section className="px-5 mb-4" role="region" aria-roledescription="carousel" aria-label="암장 상세 정보">
      <div className="mb-2 mt-2 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 py-3">
        <button
          type="button"
          onClick={() => selectSlide(activeSlide - 1)}
          disabled={!navigation.hasPrevious}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-[22px] text-neutral-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={!navigation.hasPrevious ? '이전 슬라이드 없음' : `이전 슬라이드: ${gymDetailSlideLabel(activeSlide - 1)}`}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <h2 id={`${carouselId}-title`} className="truncate text-center text-[18px] font-bold text-neutral-900">{GYM_DETAIL_SLIDE_TITLES[activeSlide]}</h2>
        <button
          type="button"
          onClick={() => selectSlide(activeSlide + 1)}
          disabled={!navigation.hasNext}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-[22px] text-neutral-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={!navigation.hasNext ? '다음 슬라이드 없음' : `다음 슬라이드: ${gymDetailSlideLabel(activeSlide + 1)}`}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <p id={`${carouselId}-instructions`} className="sr-only">좌우 방향키로 슬라이드를 이동하고 Home과 End 키로 처음과 마지막 슬라이드로 이동할 수 있습니다.</p>
      <p className="sr-only" aria-live="polite">{gymDetailSlideLabel(activeSlide)} 표시 중</p>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-labelledby={`${carouselId}-title`}
        aria-describedby={`${carouselId}-instructions`}
        className="flex w-full snap-x snap-mandatory overflow-x-auto rounded-2xl select-none touch-pan-x cursor-grab outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
          <div ref={(node) => { slideRefs.current[0] = node; }} role="group" aria-roledescription="slide" aria-label={gymDetailSlideLabel(0)} aria-hidden={activeSlide !== 0} inert={activeSlide !== 0} className="w-full flex-shrink-0 snap-center min-h-[300px] bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-4 relative flex flex-col">
            <div className="mb-4 flex min-h-11 items-center justify-center gap-3 text-center">
              <button
                type="button"
                onClick={() => onChangeEventMonth?.(-1)}
                onKeyDown={handleMonthControlKeyDown}
                tabIndex={activeSlide === 0 ? 0 : -1}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[20px] font-medium text-neutral-700 shadow-sm"
                aria-label="이전 달"
              >
                ‹
              </button>
              <h3 className="text-[18px] font-bold text-neutral-900">{monthLabel}</h3>
              <button
                type="button"
                onClick={() => onChangeEventMonth?.(1)}
                onKeyDown={handleMonthControlKeyDown}
                tabIndex={activeSlide === 0 ? 0 : -1}
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

          <div ref={(node) => { slideRefs.current[1] = node; }} role="group" aria-roledescription="slide" aria-label={gymDetailSlideLabel(1)} aria-hidden={activeSlide !== 1} inert={activeSlide !== 1} className="w-full flex-shrink-0 snap-center rounded-2xl bg-white border border-neutral-200 p-3 min-h-[300px]">
            <div className="grid grid-cols-[1.5fr_1fr] gap-3 h-full min-h-[276px]">
              <div className="rounded-2xl overflow-hidden bg-neutral-100">
                {photos[0] ? <ImageWithFallback src={photos[0]} alt="암장 대표 사진" className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center text-[13px] text-neutral-400">등록된 사진이 없습니다.</div>}
              </div>
              <div className="grid grid-rows-2 gap-3">
                {photos.slice(1, 3).map((photo, index) => (
                  <div key={photo} className="rounded-2xl overflow-hidden relative">
                    <ImageWithFallback src={photo} alt={`암장 사진 ${index + 2}`} className="w-full h-full object-cover" />
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

          <div ref={(node) => { slideRefs.current[2] = node; }} role="group" aria-roledescription="slide" aria-label={gymDetailSlideLabel(2)} aria-hidden={activeSlide !== 2} inert={activeSlide !== 2} className="w-full flex-shrink-0 snap-center min-h-[300px] bg-neutral-100 rounded-2xl relative overflow-hidden">
            {mapImage ? <ImageWithFallback src={mapImage} alt="암장 위치 지도 이미지" className="h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-neutral-500">{mapHref ? '등록된 위치 지도 이미지가 없습니다.' : '좌표 정보가 없어 위치 지도를 열 수 없습니다.'}</div>}
            <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-2 text-[12px] font-semibold text-neutral-700 shadow-sm">위치 지도</div>
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                tabIndex={activeSlide === 2 ? 0 : -1}
                className="absolute bottom-3 left-3 flex min-h-11 items-center rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-blue-700 shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                aria-label={`${mapLinkLabel} (새 창)`}
              >
                카카오맵에서 위치 보기
              </a>
            )}
          </div>
      </div>

      <div className="mt-2 mb-3 flex justify-center" role="group" aria-label="슬라이드 선택">
        {GYM_DETAIL_SLIDE_TITLES.map((title, index) => (
          <button
            type="button"
            ref={(node) => { slideControlRefs.current[index] = node; }}
            key={title}
            onClick={() => selectSlide(index)}
            className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
            aria-label={`${gymDetailSlideLabel(index)}로 이동`}
            aria-current={activeSlide === index ? 'true' : undefined}
          >
            <span aria-hidden="true" className={`h-1.5 rounded-full transition-all ${activeSlide === index ? 'w-4 bg-blue-500' : 'w-1.5 bg-neutral-300'}`} />
          </button>
        ))}
      </div>
    </section>
  );
}
