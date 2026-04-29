export type NotificationCategory = 'setting' | 'gym' | 'membership' | 'all';

export interface NotificationItem {
  id: number;
  gymInitials: string;
  gymColor: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  category: NotificationCategory;
}

export interface NotificationFilter {
  id: NotificationCategory;
  label: string;
  value: NotificationCategory;
}
