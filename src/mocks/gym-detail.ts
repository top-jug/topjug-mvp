import { GymFacility } from '../entities/gym/types';

export const GYM_DETAIL_TITLE = '더클라임 연남';

export const GYM_DETAIL_CALENDAR_DAYS: Array<number | ''> = [
  '', '', 1, 2, 3, 4, 5,
  6, 7, 8, 9, 10, 11, 12,
  13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26,
  27, 28, 29, 30, '', '', '',
];

export const GYM_DETAIL_DIFFICULTY_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-lime-500', 'bg-green-500', 'bg-blue-500', 'bg-indigo-600', 'bg-purple-600'];

export const GYM_DETAIL_FACILITIES: GymFacility[] = [
  { label: '샤워실', icon: 'shower' },
  { label: '볼더', icon: 'boulder' },
  { label: '스트레칭존', icon: 'stretch' },
  { label: '주차가능', icon: 'parking' },
];

export const GYM_DETAIL_INFO = {
  address: '서울 마포구 양화로 186',
  nearby: '홍대입구역 4번 출구에서 120m',
  weekdayHours: '10:00 - 22:00',
  weekendHours: '10:00 - 20:00',
  photos: [
    'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=900&h=700&fit=crop',
    'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=700&h=500&fit=crop',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=700&h=500&fit=crop',
    'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=700&h=500&fit=crop'
  ],
  mapImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&h=500&fit=crop',
};
