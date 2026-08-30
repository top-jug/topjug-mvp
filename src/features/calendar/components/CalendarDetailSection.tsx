import { UIEvent, useLayoutEffect, useRef } from 'react';
import { ImageWithFallback } from '../../../app/components/figma/ImageWithFallback';
import { CalendarData, CalendarGym } from '../../../entities/calendar/types';
import { getCalendarSlideStateKey, reconcileCalendarSlide } from '../calendar-state';
import { recordSessionTypeLabel } from '../../record/session-labels';

interface CalendarDetailSectionProps {
  mode: 'record' | 'setting';
  year: number;
  month: number;
  selectedDate: number | null;
  activeSlide: number;
  gyms: CalendarGym[];
  calendarData: CalendarData;
  onOpenGym: (gymId: string) => void;
  onOpenRecord: (recordId: string) => void;
  onSelectSlide: (index: number) => void;
}

export default function CalendarDetailSection({ mode, year, month, selectedDate, activeSlide, gyms, calendarData, onOpenGym, onOpenRecord, onSelectSlide }: CalendarDetailSectionProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const previousSlideStateKeyRef = useRef<{ context: string; entries: string } | null>(null);
  const expectedSlideRef = useRef(activeSlide);
  const entries = selectedDate ? calendarData[selectedDate] : undefined;
  const visibleEntries = entries ?? [];
  const slideStateKey = getCalendarSlideStateKey({
    mode,
    year,
    month,
    selectedDate,
    entryKeys: visibleEntries.map((entry, index) => (
      entry.settingEventId ?? entry.recordId ?? `${entry.gymId ?? entry.gym}:${entry.startsAt ?? index}:${entry.wall}`
    )),
  });
  const emptyLabel = mode === 'record' ? '이 날짜에 등록된 기록이 없습니다.' : '이 날짜에 등록된 세팅 정보가 없습니다.';

  useLayoutEffect(() => {
    const previousKey = previousSlideStateKeyRef.current;
    const shouldReset = previousKey?.context !== slideStateKey.context;
    const entriesChanged = previousKey?.entries !== slideStateKey.entries;
    const nextSlide = reconcileCalendarSlide(activeSlide, visibleEntries.length, shouldReset);
    previousSlideStateKeyRef.current = slideStateKey;
    expectedSlideRef.current = nextSlide;

    const container = carouselRef.current;
    const slide = container?.children[nextSlide] as HTMLElement | undefined;
    if (container && (shouldReset || entriesChanged || nextSlide !== activeSlide)) {
      container.scrollLeft = slide?.offsetLeft ?? 0;
    }
    if (nextSlide !== activeSlide) onSelectSlide(nextSlide);
  }, [activeSlide, onSelectSlide, slideStateKey.context, slideStateKey.entries, visibleEntries.length]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const slides = Array.from(container.children) as HTMLElement[];
    const nextIndex = slides.reduce(
      (nearest, slide, index) => {
        const distance = Math.abs(slide.offsetLeft - container.scrollLeft);
        return distance < nearest.distance ? { index, distance } : nearest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    ).index;

    if (nextIndex !== expectedSlideRef.current) {
      expectedSlideRef.current = nextIndex;
      onSelectSlide(nextIndex);
    }
  };

  const handleSelectSlide = (index: number) => {
    expectedSlideRef.current = index;
    const slide = carouselRef.current?.children[index] as HTMLElement | undefined;
    if (carouselRef.current) carouselRef.current.scrollLeft = slide?.offsetLeft ?? 0;
    onSelectSlide(index);
  };

  return (
    <div className="px-4 pb-16">
      {visibleEntries.length > 0 ? (
        <>
          <div ref={carouselRef} onScroll={handleScroll} className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4">
            {visibleEntries.map((entry, idx) => {
              const gymInfo = gyms.find((gym) => gym.id === entry.gymId) ?? gyms.find((gym) => gym.name === entry.gym);
              if (!gymInfo) return null;

              return (
                <div key={entry.settingEventId ?? entry.recordId ?? `${entry.gym}-${idx}`} className="w-full flex-shrink-0 snap-center">
                  {mode === 'setting' ? (
                    <button
                      type="button"
                      onClick={() => onOpenGym(gymInfo.id)}
                      className="w-full border border-neutral-200 rounded-xl p-3 text-left cursor-pointer hover:border-neutral-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {entry.logoUrl ? (
                          <ImageWithFallback src={entry.logoUrl} alt={`${entry.gym} 로고`} className="w-12 h-12 flex-shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 object-contain" />
                        ) : (
                          <div className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center text-[24px] font-bold" style={{ backgroundColor: gymInfo.lightBg, color: gymInfo.darkText }}>
                            {entry.gym.slice(0, 1)}
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="truncate text-[16px] font-semibold text-neutral-900">{entry.gym}</div>
                          <div className="flex-shrink-0 text-[15px] font-medium text-neutral-600">{entry.wall}</div>
                        </div>
                      </div>
                      {entry.address && <div className="flex items-center gap-1 text-[13px] text-neutral-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{entry.address}</span>
                      </div>}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => entry.recordId && onOpenRecord(entry.recordId)}
                      className="w-full border border-neutral-200 rounded-xl p-4 bg-white text-left transition-colors hover:border-neutral-300"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3 mt-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {entry.logoUrl ? (
                            <ImageWithFallback src={entry.logoUrl} alt={`${entry.gym} 로고`} className="h-14 w-14 flex-shrink-0 rounded-2xl border border-neutral-200 bg-neutral-50 object-contain" />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[28px] font-bold flex-shrink-0" style={{ backgroundColor: gymInfo.lightBg, color: gymInfo.darkText }}>
                              {entry.gym.slice(0, 1)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold truncate">{entry.gym}</div>
                            <div className="text-[13px] text-neutral-500">운동 기록</div>
                          </div>
                        </div>
                        <div className="px-2 py-1 rounded-full text-[12px] font-medium" style={{ backgroundColor: gymInfo.lightBg, color: gymInfo.darkText }}>
                          완료
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="rounded-xl bg-white border border-neutral-200 px-3 py-2">
                          <div className="text-[12px] text-neutral-500 mb-1">기록 요약</div>
                          <div className="text-[14px] font-medium text-neutral-900">{entry.wall}</div>
                        </div>
                        <div className="rounded-xl bg-white border border-neutral-200 px-3 py-2">
                          <div className="text-[12px] text-neutral-500 mb-1">세션 상태</div>
                          <div className="text-[14px] font-medium text-neutral-900">{recordSessionTypeLabel(entry.sessionType)}</div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 px-3 py-3 text-[13px] text-neutral-600 leading-6">
                        {entry.rating === null || entry.rating === undefined ? '평가 없음' : `평점 ${entry.rating}`} · {entry.startsAt ? new Date(entry.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '시간 정보 없음'}
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {visibleEntries.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-4 pb-6">
              {visibleEntries.map((_, idx) => (
                <button key={idx} onClick={() => handleSelectSlide(idx)} aria-label={`${idx + 1}번째 일정 보기`} aria-pressed={idx === activeSlide} className={`h-1.5 rounded-full transition-all ${idx === activeSlide ? 'w-4 bg-[#185FA5]' : 'w-1.5 bg-neutral-300'}`} />
              ))}
            </div>
          )}
        </>
      ) : (
        selectedDate && <div className="text-center text-[14px] text-neutral-500 py-8 pb-20">{emptyLabel}</div>
      )}
    </div>
  );
}
