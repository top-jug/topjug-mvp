import { UIEvent, useRef } from 'react';
import { ImageWithFallback } from '../../../app/components/figma/ImageWithFallback';
import { CalendarData, CalendarGym } from '../../../entities/calendar/types';
import sectorMap from '../../../imports/image-4.png';

interface CalendarDetailSectionProps {
  mode: 'record' | 'setting';
  year: number;
  month: number;
  selectedDate: number | null;
  activeSlide: number;
  gyms: CalendarGym[];
  calendarData: CalendarData;
  onCardClick: () => void;
  onSelectSlide: (index: number) => void;
}

export default function CalendarDetailSection({ mode, selectedDate, activeSlide, gyms, calendarData, onCardClick, onSelectSlide }: CalendarDetailSectionProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const entries = selectedDate ? calendarData[selectedDate] : undefined;
  const visibleEntries = entries ?? [];
  const emptyLabel = mode === 'record' ? '이 날짜에 등록된 기록이 없습니다.' : '이 날짜에 등록된 세팅 정보가 없습니다.';

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

    if (nextIndex !== activeSlide) {
      onSelectSlide(nextIndex);
    }
  };

  const handleSelectSlide = (index: number) => {
    const slide = carouselRef.current?.children[index] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    onSelectSlide(index);
  };

  return (
    <div className="px-4 pb-16">
      {visibleEntries.length > 0 ? (
        <>
          <div ref={carouselRef} onScroll={handleScroll} className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4">
            {visibleEntries.map((entry, idx) => {
              const gymInfo = gyms.find((gym) => gym.name === entry.gym);
              if (!gymInfo) return null;

              return (
                <div key={`${entry.gym}-${idx}`} className="w-full flex-shrink-0 snap-center">
                  {mode === 'setting' ? (
                    <div onClick={onCardClick} className="border border-neutral-200 rounded-xl p-3 cursor-pointer hover:border-neutral-300 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[24px] font-bold" style={{ backgroundColor: gymInfo.lightBg, color: gymInfo.darkText }}>
                          {entry.gym.slice(0, 1)}
                        </div>
                        <div className="flex-1">
                          <div className="text-[15px] font-medium">{entry.gym}</div>
                          <div className="text-[13px] text-neutral-500">{entry.wall}</div>
                        </div>
                      </div>
                      <div className="h-32 bg-neutral-800 rounded-lg mb-2 overflow-hidden">
                        <ImageWithFallback src={sectorMap.src} alt="Sector Map" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex items-center gap-1 text-[13px] text-neutral-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>서울특별시 강남구</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                      <div className="flex items-start justify-between gap-3 mb-3 mt-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[28px] font-bold flex-shrink-0" style={{ backgroundColor: gymInfo.lightBg, color: gymInfo.darkText }}>
                            {entry.gym.slice(0, 1)}
                          </div>
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
                          <div className="text-[14px] font-medium text-neutral-900">집중 훈련</div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 px-3 py-3 text-[13px] text-neutral-600 leading-6">
                        {entry.gym}에서 남긴 운동 기록입니다. 상세 기록 수정은 작성 화면에서 이어집니다.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {visibleEntries.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-4 pb-6">
              {visibleEntries.map((_, idx) => (
                <button key={idx} onClick={() => handleSelectSlide(idx)} className={`h-1.5 rounded-full transition-all ${idx === activeSlide ? 'w-4 bg-[#185FA5]' : 'w-1.5 bg-neutral-300'}`} />
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
