import { Building2, LayoutDashboard, Tags, type LucideIcon } from 'lucide-react';

export type OperationsNavigationItem = {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  end?: boolean;
};

export const operationsNavigation: OperationsNavigationItem[] = [
  { path: '/ops', label: '대시보드', description: '운영 현황', icon: LayoutDashboard, end: true },
  { path: '/ops/gyms', label: '암장 관리', description: '암장 정보와 일정', icon: Building2 },
  { path: '/ops/gym-tags', label: '태그 관리', description: '암장 분류 태그', icon: Tags },
];

export function operationsPageTitle(pathname: string) {
  return operationsNavigation.find((item) => item.end ? pathname === item.path : pathname.startsWith(item.path))?.label ?? '운영 콘솔';
}
