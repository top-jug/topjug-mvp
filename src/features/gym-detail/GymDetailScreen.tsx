import { useState } from 'react';
import { GYM_DETAIL_CALENDAR_DAYS, GYM_DETAIL_DIFFICULTY_COLORS, GYM_DETAIL_FACILITIES, GYM_DETAIL_INFO, GYM_DETAIL_TITLE } from '../../mocks/gym-detail';
import GymDetailCarousel from './components/GymDetailCarousel';
import GymDetailHeader from './components/GymDetailHeader';
import GymDifficultySection from './components/GymDifficultySection';
import GymFacilitiesSection from './components/GymFacilitiesSection';
import GymInfoSection from './components/GymInfoSection';

export default function GymDetailScreen({ onClose }: { onClose: () => void; onNavigate: (screen: string) => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <>
      <GymDetailHeader title={GYM_DETAIL_TITLE} isFavorite={isFavorite} onBack={onClose} onToggleFavorite={() => setIsFavorite(!isFavorite)} />

      {/* Content */}
      <div className="overflow-y-auto pb-10 min-h-screen">
        <GymDetailCarousel currentSlide={currentSlide} photos={GYM_DETAIL_INFO.photos} mapImage={GYM_DETAIL_INFO.mapImage} calendarDays={GYM_DETAIL_CALENDAR_DAYS} onSlideChange={setCurrentSlide} />

        <GymDifficultySection colors={GYM_DETAIL_DIFFICULTY_COLORS} />

        <GymInfoSection
          address={GYM_DETAIL_INFO.address}
          nearby={GYM_DETAIL_INFO.nearby}
          weekdayHours={GYM_DETAIL_INFO.weekdayHours}
          weekendHours={GYM_DETAIL_INFO.weekendHours}
        />

        <GymFacilitiesSection facilities={GYM_DETAIL_FACILITIES} />

      </div>
    </>
  );
}
