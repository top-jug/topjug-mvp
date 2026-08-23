import { CalendarData, CalendarGym } from '../entities/calendar/types';

export const CALENDAR_GYMS: CalendarGym[] = [
  { name: '더클라임 강남', color: '#185FA5', lightBg: '#E6F1FB', darkText: '#0C447C' },
  { name: '더클라임 양재', color: '#3B6D11', lightBg: '#EAF3DE', darkText: '#27500A' },
  { name: '클라임웍스 홍대', color: '#D85A30', lightBg: '#FAECE7', darkText: '#712B13' },
  { name: '더클라임 신촌', color: '#854F0B', lightBg: '#FAEEDA', darkText: '#633806' },
];

export const CALENDAR_SETTING_ENTRIES: CalendarData = {
  7: [{ gym: '더클라임 양재', wall: '메인월' }],
  9: [{ gym: '더클라임 양재', wall: '오버행' }],
  11: [{ gym: '더클라임 양재', wall: '슬랩' }],
  12: [
    { gym: '더클라임 강남', wall: '메인월' },
    { gym: '클라임웍스 홍대', wall: '미들월' },
    { gym: '더클라임 신촌', wall: '오버행' },
    { gym: '더클라임 양재', wall: '슬랩' },
    { gym: '더클라임 강남', wall: '버디클imb' },
  ],
};

export const CALENDAR_RECORD_ENTRIES: CalendarData = {
  3: [{ gym: '더클라임 강남', wall: 'V4 완료', recordId: 'calendar-2026-04-03-0' }],
  8: [{ gym: '클라임웍스 홍대', wall: '세션 기록', recordId: 'calendar-2026-04-08-0' }],
  12: [
    { gym: '더클라임 강남', wall: 'V5 시도', recordId: 'calendar-2026-04-12-0' },
    { gym: '더클라임 양재', wall: 'V4 완료', recordId: 'calendar-2026-04-12-1' },
  ],
  19: [{ gym: '더클라임 신촌', wall: '리드 훈련', recordId: 'calendar-2026-04-19-0' }],
  24: [{ gym: '클라임웍스 홍대', wall: '문제 6개', recordId: 'calendar-2026-04-24-0' }],
};

export const CALENDAR_GRID_DAYS: Array<number | ''> = ['', '', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, '', '', ''];
export const CALENDAR_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
