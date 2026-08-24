export const HOME_SUMMARY_COMPACT_MAX_WIDTH = 375;
export const CALENDAR_COMPACT_MAX_WIDTH = 359;
export const SHARE_PREVIEW_DESIGN_WIDTH = 353;
export const MOBILE_PAGE_INLINE_PADDING = 40;

export interface MobileLayoutDecision {
  homeSummary: 'compact' | 'regular';
  calendarPeriod: 'month-only' | 'full';
  sharePreviewScale: number;
}

export function getMobileLayoutDecision(viewportWidth: number): MobileLayoutDecision {
  return {
    homeSummary: viewportWidth <= HOME_SUMMARY_COMPACT_MAX_WIDTH ? 'compact' : 'regular',
    calendarPeriod: viewportWidth <= CALENDAR_COMPACT_MAX_WIDTH ? 'month-only' : 'full',
    sharePreviewScale: Math.min(
      1,
      Math.max(0, viewportWidth - MOBILE_PAGE_INLINE_PADDING) / SHARE_PREVIEW_DESIGN_WIDTH,
    ),
  };
}

export function compactCalendarPeriodLabel(periodLabel: string) {
  return periodLabel.match(/\d{1,2}월\s*$/)?.[0].trim() ?? periodLabel;
}
