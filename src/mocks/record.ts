import { CountPass, DifficultyOption, PeriodPass } from '../entities/record/types';

export const RECORD_DIFFICULTIES: DifficultyOption[] = [
  { color: 'bg-purple-600', name: '보라', grade: 'V8' },
  { color: 'bg-indigo-600', name: '남색', grade: 'V7' },
  { color: 'bg-blue-500', name: '파랑', grade: 'V6' },
  { color: 'bg-green-500', name: '초록', grade: 'V5' },
  { color: 'bg-lime-500', name: '연두', grade: 'V4' },
  { color: 'bg-yellow-400', name: '노랑', grade: 'V3' },
  { color: 'bg-orange-500', name: '주황', grade: 'V2' },
  { color: 'bg-red-500', name: '빨강', grade: 'V1' },
];

export const COUNT_PASSES: CountPass[] = [
  { id: 1, gym: '더클라임', remaining: 2, total: 5 },
  { id: 2, gym: '피커스', remaining: 7, total: 10 },
];

export const PERIOD_PASSES: PeriodPass[] = [
  { id: 1, gym: '더클라임', daysLeft: 34, expiryDate: '2026-05-13', expiryDay: '화' },
  { id: 2, gym: '볼더리엉', daysLeft: 12, expiryDate: '2026-04-21', expiryDay: '화' },
];

export const RECORD_GYMS = ['더클라임 양재', '더클라임 신림', '피커스 홀딩', '볼더리엉 학리', '클라이밍파크'];

export const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
