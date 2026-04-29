import { NotificationFilter, NotificationItem } from '../entities/notification/types';

export const NOTIFICATION_ITEMS: NotificationItem[] = [
  { id: 1, gymInitials: 'TC', gymColor: 'bg-blue-500', message: '더클라임 양재 세팅 일정이 변경되었습니다.', timestamp: '5분 전', isRead: false, category: 'setting' },
  { id: 2, gymInitials: 'PK', gymColor: 'bg-purple-500', message: '피커스 홍대 새로운 회원권 혜택 도착!', timestamp: '1시간 전', isRead: false, category: 'membership' },
  { id: 3, gymInitials: 'CP', gymColor: 'bg-orange-500', message: '클라이밍파크 신규 섹터가 오픈되었습니다.', timestamp: '3시간 전', isRead: true, category: 'gym' },
  { id: 4, gymInitials: 'BG', gymColor: 'bg-green-500', message: '볼더가든 1섹터 세팅이 완료되었습니다.', timestamp: '5시간 전', isRead: true, category: 'setting' },
  { id: 5, gymInitials: 'TC', gymColor: 'bg-blue-500', message: '더클라임 양재 회원권이 곧 만료됩니다.', timestamp: '1일 전', isRead: true, category: 'membership' },
  { id: 6, gymInitials: 'PK', gymColor: 'bg-purple-500', message: '피커스 홍대 특별 이벤트를 확인하세요!', timestamp: '2일 전', isRead: true, category: 'gym' },
];

export const NOTIFICATION_FILTERS: NotificationFilter[] = [
  { id: 'all', label: '전체', value: 'all' },
  { id: 'setting', label: '세팅', value: 'setting' },
  { id: 'gym', label: '암장', value: 'gym' },
  { id: 'membership', label: '회원권', value: 'membership' },
];
