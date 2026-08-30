export const GYM_DETAIL_SLIDE_TITLES = ['암장 캘린더', '암장 사진', '위치 지도'] as const;

export function clampCarouselSlide(index: number, slideCount: number) {
  if (slideCount <= 0) return 0;
  return Math.max(0, Math.min(slideCount - 1, Math.trunc(index)));
}

export function carouselSlideForKey(key: string, currentSlide: number, slideCount: number) {
  if (slideCount <= 0) return null;
  if (key === 'ArrowLeft') return clampCarouselSlide(currentSlide - 1, slideCount);
  if (key === 'ArrowRight') return clampCarouselSlide(currentSlide + 1, slideCount);
  if (key === 'Home') return 0;
  if (key === 'End') return slideCount - 1;
  return null;
}

export function carouselNavigationAvailability(currentSlide: number, slideCount: number) {
  const activeSlide = clampCarouselSlide(currentSlide, slideCount);
  return {
    hasPrevious: slideCount > 0 && activeSlide > 0,
    hasNext: slideCount > 0 && activeSlide < slideCount - 1,
  };
}

export function shouldSyncCarouselScroll(observedSlide: number, programmaticTarget: number | null) {
  return programmaticTarget === null || observedSlide === programmaticTarget;
}

export function shouldTransferCarouselFocus(currentSlide: number, nextSlide: number, focusIsWithinCurrentSlide: boolean) {
  return focusIsWithinCurrentSlide && currentSlide !== nextSlide;
}

export function isHorizontalArrowKey(key: string) {
  return key === 'ArrowLeft' || key === 'ArrowRight';
}

export function gymDetailSlideLabel(index: number, slideCount = GYM_DETAIL_SLIDE_TITLES.length) {
  const safeIndex = clampCarouselSlide(index, slideCount);
  const title = GYM_DETAIL_SLIDE_TITLES[safeIndex] ?? '슬라이드';
  return `${title}, ${safeIndex + 1}/${slideCount}`;
}

export function isValidKakaoMapPoint(latitude: number | null | undefined, longitude: number | null | undefined) {
  return typeof latitude === 'number'
    && typeof longitude === 'number'
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

export function getKakaoMapScriptSrc(appKey: string) {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
}

export function buildGymMapLink(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (!isValidKakaoMapPoint(latitude, longitude)) return null;

  return `https://map.kakao.com/link/map/${latitude},${longitude}`;
}

export function normalizeKakaoMapAddress(address: string | null | undefined) {
  const normalized = address?.trim();
  return normalized || null;
}

export function hasKakaoLocationSource(input: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}) {
  return isValidKakaoMapPoint(input.latitude, input.longitude) || Boolean(normalizeKakaoMapAddress(input.address));
}
