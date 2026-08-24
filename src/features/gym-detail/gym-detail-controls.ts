export const GYM_DETAIL_SLIDE_TITLES = ['암장 캘린더', '암장 사진', '지도'] as const;

export function clampCarouselSlide(index: number, slideCount: number) {
  if (slideCount <= 0) return 0;
  return Math.max(0, Math.min(slideCount - 1, Math.trunc(index)));
}

export function wrapCarouselSlide(index: number, slideCount: number) {
  if (slideCount <= 0) return 0;
  return ((Math.trunc(index) % slideCount) + slideCount) % slideCount;
}

export function carouselSlideForKey(key: string, currentSlide: number, slideCount: number) {
  if (slideCount <= 0) return null;
  if (key === 'ArrowLeft') return wrapCarouselSlide(currentSlide - 1, slideCount);
  if (key === 'ArrowRight') return wrapCarouselSlide(currentSlide + 1, slideCount);
  if (key === 'Home') return 0;
  if (key === 'End') return slideCount - 1;
  return null;
}

export function gymDetailSlideLabel(index: number, slideCount = GYM_DETAIL_SLIDE_TITLES.length) {
  const safeIndex = clampCarouselSlide(index, slideCount);
  const title = GYM_DETAIL_SLIDE_TITLES[safeIndex] ?? '슬라이드';
  return `${title}, ${safeIndex + 1}/${slideCount}`;
}

export function buildGymMapLink(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (
    typeof latitude !== 'number'
    || typeof longitude !== 'number'
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}
