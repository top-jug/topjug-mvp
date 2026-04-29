import { ImageWithFallback } from '../../../app/components/figma/ImageWithFallback';

interface GymDetailCarouselProps {
  currentSlide: number;
  photos: string[];
  mapImage: string;
  calendarDays: Array<number | ''>;
  onCycleSlide: () => void;
}

export default function GymDetailCarousel({ currentSlide, photos, mapImage, calendarDays, onCycleSlide }: GymDetailCarouselProps) {
  return (
    <div className="px-5 mb-4">
      <div className="overflow-hidden mb-2 mt-2">
        <div className="flex transition-transform duration-300" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
          {['암장 사진', '암장캘린더', '지도'].map((title) => (
            <div key={title} className="w-full flex-shrink-0 flex items-center justify-between px-0 py-3">
              <h2 className="text-[18px] font-bold text-neutral-900">{title}</h2>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full rounded-2xl overflow-hidden relative select-none cursor-pointer" onClick={onCycleSlide}>
        <div className="flex transition-transform duration-300" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
          <div className="w-full flex-shrink-0 rounded-2xl bg-white border border-neutral-200 p-3">
            <div className="grid grid-cols-[1.5fr_1fr] gap-3 h-64">
              <div className="rounded-2xl overflow-hidden">
                <ImageWithFallback src={photos[0]} alt="Gym Photo Main" className="w-full h-full object-cover" />
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

          <div className="w-full flex-shrink-0 h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-4 relative">
            <div className="text-center mb-3">
              <h3 className="text-[17px] font-bold text-neutral-900">2026년 4월</h3>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <div key={day} className="text-[12px] font-medium text-neutral-500 py-1">{day}</div>
              ))}
              {calendarDays.map((date, i) => (
                <div
                  key={`${date}-${i}`}
                  className={`text-[13px] py-1.5 ${
                    date === 12
                      ? 'bg-blue-500 text-white rounded-full font-bold'
                      : date === 7 || date === 9 || date === 11
                        ? 'bg-blue-100 text-blue-600 rounded-full font-medium'
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

          <div className="w-full flex-shrink-0 h-64 bg-gradient-to-br from-blue-50 via-green-50 to-blue-100 rounded-2xl relative">
            <img src={mapImage} alt="Map" className="w-full h-full object-cover opacity-40" />
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
      </div>

      <div className="flex justify-center gap-1.5 mt-3 mb-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className={`w-1.5 h-1.5 rounded-full transition-colors ${currentSlide === index ? 'bg-blue-500' : 'bg-neutral-300'}`} />
        ))}
      </div>
    </div>
  );
}
