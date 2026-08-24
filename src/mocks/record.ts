import { ClimbingRecord, CountPass, DifficultyOption, PeriodPass } from '../entities/record/types';

export const RECORD_DIFFICULTIES: DifficultyOption[] = [
  { id: 'mock-v8', color: 'bg-purple-600', name: '보라', grade: 'V8' },
  { id: 'mock-v7', color: 'bg-indigo-600', name: '남색', grade: 'V7' },
  { id: 'mock-v6', color: 'bg-blue-500', name: '파랑', grade: 'V6' },
  { id: 'mock-v5', color: 'bg-green-500', name: '초록', grade: 'V5' },
  { id: 'mock-v4', color: 'bg-lime-500', name: '연두', grade: 'V4' },
  { id: 'mock-v3', color: 'bg-yellow-400', name: '노랑', grade: 'V3' },
  { id: 'mock-v2', color: 'bg-orange-500', name: '주황', grade: 'V2' },
  { id: 'mock-v1', color: 'bg-red-500', name: '빨강', grade: 'V1' },
];

export const COUNT_PASSES: CountPass[] = [
  { id: 'mock-count-1', name: '더클라임 횟수권', gym: '더클라임', gymIds: [], remaining: 2, total: 5 },
  { id: 'mock-count-2', name: '피커스 횟수권', gym: '피커스', gymIds: [], remaining: 7, total: 10 },
];

export const PERIOD_PASSES: PeriodPass[] = [
  { id: 'mock-period-1', name: '더클라임 기간권', gym: '더클라임', gymIds: [], daysLeft: 34, expiryDate: '2026-05-13', expiryDay: '화' },
  { id: 'mock-period-2', name: '볼더리엉 기간권', gym: '볼더리엉', gymIds: [], daysLeft: 12, expiryDate: '2026-04-21', expiryDay: '화' },
];

export const RECORD_GYMS = ['더클라임 양재', '더클라임 신림', '피커스 홀딩', '볼더리엉 학리', '클라이밍파크'];

export const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function createCalendarRecord(id: string, gym: string, date: string, success: number, attempt: number, rating: number): ClimbingRecord {
  return {
    id,
    gym,
    date,
    duration: '01:30:00',
    passLabel: '일일이용권',
    rating,
    mode: 'normal',
    routeCounts: {
      'sector1-4': { success, attempt },
    },
    createdAt: `${date.replaceAll('.', '-')}T12:30:00.000Z`,
  };
}

export const INITIAL_RECORD_HISTORY: ClimbingRecord[] = [
  {
    id: 'sample-1',
    gym: '더클라임 양재',
    date: '2026.08.21',
    duration: '01:42:18',
    passLabel: '횟수권',
    rating: 4.5,
    mode: 'normal',
    routeCounts: {
      'sector1-5': { success: 4, attempt: 6 },
      'sector1-4': { success: 3, attempt: 5 },
      'sector2-3': { success: 1, attempt: 4 },
    },
    createdAt: '2026-08-21T12:42:18.000Z',
  },
  {
    id: 'sample-2',
    gym: '피커스 홀딩',
    date: '2026.08.17',
    duration: '02:05:44',
    passLabel: '일일이용권',
    rating: 4,
    mode: 'easy',
    routeCounts: {
      'easy-4': { success: 5, attempt: 8 },
      'easy-3': { success: 2, attempt: 6 },
    },
    createdAt: '2026-08-17T13:05:44.000Z',
  },
  createCalendarRecord('calendar-2026-04-24-0', '클라임웍스 홍대', '2026.04.24', 6, 11, 4),
  createCalendarRecord('calendar-2026-04-19-0', '더클라임 신촌', '2026.04.19', 4, 9, 3.5),
  createCalendarRecord('calendar-2026-04-12-1', '더클라임 양재', '2026.04.12', 5, 10, 4.5),
  createCalendarRecord('calendar-2026-04-12-0', '더클라임 강남', '2026.04.12', 3, 8, 3.5),
  createCalendarRecord('calendar-2026-04-08-0', '클라임웍스 홍대', '2026.04.08', 4, 7, 4),
  createCalendarRecord('calendar-2026-04-03-0', '더클라임 강남', '2026.04.03', 4, 9, 4),
];
