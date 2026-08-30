import { useState } from 'react';
import { LogOut, Menu, Mountain, UserRound } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { cn } from '../../app/components/ui/utils';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../app/components/ui/sheet';
import { operationsNavigation, operationsPageTitle } from './navigation';

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-center', compact ? 'justify-center' : 'gap-3')}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
        <Mountain aria-hidden="true" className="h-5 w-5" />
      </div>
      {!compact && (
        <div>
          <div className="text-sm font-black tracking-tight text-slate-950">TOPJUG</div>
          <div className="text-xs font-semibold text-slate-500">Operations</div>
        </div>
      )}
    </div>
  );
}

function Navigation({ compact = false, mobile = false }: { compact?: boolean; mobile?: boolean }) {
  return (
    <nav aria-label="운영 콘솔 메뉴" className="space-y-1">
      {operationsNavigation.map(({ path, label, description, icon: Icon, end }) => {
        const link = (
          <NavLink
            to={path}
            end={end}
            title={compact ? label : undefined}
            className={({ isActive }) => cn(
              'group flex min-h-12 items-center rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
              compact ? 'justify-center px-2' : 'gap-3 px-3',
              isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
            )}
          >
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            {!compact && (
              <span className="min-w-0">
                <span className="block">{label}</span>
                <span className="block truncate text-xs font-medium text-slate-400">{description}</span>
              </span>
            )}
            {compact && <span className="sr-only">{label}</span>}
          </NavLink>
        );
        return mobile ? <SheetClose asChild key={path}>{link}</SheetClose> : <div key={path}>{link}</div>;
      })}
    </nav>
  );
}

export function OperationsLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 border-r border-slate-200 bg-white px-3 py-5 md:flex md:flex-col lg:w-64 lg:px-5">
        <div className="hidden lg:block"><Brand /></div>
        <div className="lg:hidden"><Brand compact /></div>
        <div className="mt-8 flex-1">
          <div className="hidden lg:block"><Navigation /></div>
          <div className="lg:hidden"><Navigation compact /></div>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          title="로그아웃"
          className="flex min-h-12 items-center justify-center rounded-xl px-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 lg:justify-start lg:gap-3 lg:px-3"
        >
          <LogOut aria-hidden="true" className="h-5 w-5" />
          <span className="hidden text-sm font-bold lg:inline">로그아웃</span>
          <span className="sr-only lg:hidden">로그아웃</span>
        </button>
      </aside>

      <div className="md:pl-20 lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 md:hidden" aria-label="운영 메뉴 열기">
                  <Menu aria-hidden="true" className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(84vw,320px)] gap-0 bg-white p-0">
                <SheetHeader className="border-b border-slate-200 p-5 pr-12 text-left">
                  <SheetTitle><Brand /></SheetTitle>
                  <SheetDescription className="sr-only">운영 콘솔 페이지를 선택하세요.</SheetDescription>
                </SheetHeader>
                <div className="p-4"><Navigation mobile /></div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Operations console</p>
              <h1 className="truncate text-lg font-black tracking-tight">{operationsPageTitle(location.pathname)}</h1>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
            <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="max-w-28 truncate text-sm font-bold sm:max-w-48">{user?.displayName}</span>
            <span className="hidden rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-700 sm:inline">운영자</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
