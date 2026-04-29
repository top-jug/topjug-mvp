import { useState } from 'react';
import DifficultyComparisonModal from '../../app/components/DifficultyComparisonModal';
import BottomTabBar from '../../app/components/layout/BottomTabBar';
import { GYM_DETAIL_CALENDAR_DAYS, GYM_DETAIL_DIFFICULTY_COLORS, GYM_DETAIL_FACILITIES, GYM_DETAIL_INFO, GYM_DETAIL_TITLE } from '../../mocks/gym-detail';
import GymDetailCarousel from './components/GymDetailCarousel';
import GymDetailHeader from './components/GymDetailHeader';
import GymDifficultySection from './components/GymDifficultySection';
import GymFacilitiesSection from './components/GymFacilitiesSection';
import GymInfoSection from './components/GymInfoSection';

export default function GymDetailScreen({ onClose, onNavigate }: { onClose: () => void; onNavigate: (screen: string) => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);

  const handleSlideClick = () => {
    setCurrentSlide((currentSlide + 1) % 3);
  };

  return (
    <>
      <GymDetailHeader title={GYM_DETAIL_TITLE} isFavorite={isFavorite} onBack={onClose} onToggleFavorite={() => setIsFavorite(!isFavorite)} />

      {/* Content */}
      <div className="overflow-y-auto pb-32 min-h-screen">
        <GymDetailCarousel currentSlide={currentSlide} photos={GYM_DETAIL_INFO.photos} mapImage={GYM_DETAIL_INFO.mapImage} calendarDays={GYM_DETAIL_CALENDAR_DAYS} onCycleSlide={handleSlideClick} />

        <GymDifficultySection colors={GYM_DETAIL_DIFFICULTY_COLORS} onOpenComparison={() => setShowDifficultyModal(true)} />

        <GymInfoSection
          address={GYM_DETAIL_INFO.address}
          nearby={GYM_DETAIL_INFO.nearby}
          weekdayHours={GYM_DETAIL_INFO.weekdayHours}
          weekendHours={GYM_DETAIL_INFO.weekendHours}
        />

        <GymFacilitiesSection facilities={GYM_DETAIL_FACILITIES} />

      </div>

      <DifficultyComparisonModal
        isOpen={showDifficultyModal}
        onClose={() => setShowDifficultyModal(false)}
      />

      <BottomTabBar activeTab="gymSearch" onNavigate={onNavigate} />
    </>
  );
}
