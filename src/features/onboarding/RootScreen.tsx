import { CalendarDays, ChevronRight, MapPinned, NotebookPen } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandIcon, BrandLockup } from '../../app/components/brand/BrandLogo';
import HomeScreen from '../home/HomeScreen';
import { useAuth } from '../auth/AuthProvider';
import { getRootRouteView } from './root-route';

export default function RootScreen() {
  const { status, error, retry } = useAuth();
  const view = getRootRouteView(status);

  if (view === 'home') return <HomeScreen />;

  if (view === 'loading') {
    return (
      <main className="mobile-screen flex items-center justify-center bg-[#f3faf8] px-6" aria-busy="true" aria-live="polite">
        <div className="text-center">
          <BrandIcon className="mx-auto h-20 w-20 rounded-[24px] shadow-[0_16px_40px_rgba(13,148,136,0.16)]" />
          <div className="mx-auto mt-6 h-7 w-7 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" aria-hidden="true" />
          <h1 className="mt-4 text-base font-bold text-neutral-800">로그인 상태를 확인하고 있어요</h1>
        </div>
      </main>
    );
  }

  if (view === 'error') {
    return (
      <main className="mobile-screen flex items-center justify-center bg-[#f3faf8] px-5">
        <section className="w-full max-w-sm rounded-[28px] border border-teal-100 bg-white p-7 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <BrandIcon className="mx-auto h-16 w-16 rounded-[20px]" />
          <h1 className="mt-5 text-xl font-black tracking-[-0.03em] text-neutral-950">로그인 상태를 확인하지 못했어요</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">{error?.message ?? '네트워크 연결을 확인하고 다시 시도해주세요.'}</p>
          <button type="button" onClick={() => void retry()} className="mt-6 h-12 w-full rounded-2xl bg-teal-600 text-sm font-bold text-white transition hover:bg-teal-700">
            다시 시도
          </button>
        </section>
      </main>
    );
  }

  return <Onboarding />;
}

function Onboarding() {
  return (
    <main className="mobile-screen overflow-hidden bg-[#f3faf8] text-neutral-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden" aria-hidden="true">
        <div className="absolute -right-28 -top-24 h-80 w-80 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute -left-24 top-48 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-8 pt-[max(1.25rem,var(--mobile-safe-top))] sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <BrandLockup compact />
          <Link to="/login" className="flex min-h-11 items-center rounded-full border border-teal-200 bg-white/80 px-5 text-sm font-bold text-teal-800 backdrop-blur transition hover:bg-white">
            로그인
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:py-16">
          <section>
            <div className="inline-flex rounded-full border border-teal-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-teal-700">CLIMB · LOG · GROW</div>
            <h1 className="mt-6 max-w-[680px] text-[40px] font-black leading-[1.08] tracking-[-0.055em] text-neutral-950 sm:text-6xl lg:text-[68px]">
              오를수록 쌓이는<br /><span className="text-teal-600">나만의 클라이밍.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-neutral-600 sm:text-lg sm:leading-8">
              갈 암장을 찾고, 세팅 일정을 확인하고, 오늘의 완등을 기록하세요. TopJug가 다음 등반까지 한곳에서 이어드립니다.
            </p>

            <div className="mt-8 grid gap-3 sm:flex">
              <Link to="/register" className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-7 text-base font-bold text-white shadow-[0_14px_30px_rgba(13,148,136,0.22)] transition hover:bg-teal-700">
                무료로 시작하기 <ChevronRight size={19} />
              </Link>
              <Link to="/gyms" className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-7 text-base font-bold text-neutral-800 transition hover:border-teal-200 hover:text-teal-700">
                <MapPinned size={19} /> 암장 둘러보기
              </Link>
            </div>
          </section>

          <section className="relative mx-auto w-full max-w-[470px] lg:mx-0" aria-label="TopJug 주요 기능">
            <div className="absolute inset-10 rounded-full bg-teal-300/25 blur-3xl" aria-hidden="true" />
            <div className="relative rounded-[36px] border border-white/80 bg-white/85 p-5 shadow-[0_30px_80px_rgba(15,118,110,0.14)] backdrop-blur sm:p-7">
              <div className="flex items-center gap-4 border-b border-neutral-100 pb-5">
                <BrandIcon className="h-16 w-16 rounded-[20px]" />
                <div>
                  <div className="text-xs font-bold tracking-[0.14em] text-teal-600">YOUR NEXT SEND</div>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.035em]">오늘은 어디를 오를까요?</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <FeatureLink to="/gyms" icon={<MapPinned size={22} />} title="암장 탐색" description="가까운 암장과 상세 정보를 찾아보세요" />
                <FeatureLink to="/schedule/settings" icon={<CalendarDays size={22} />} title="세팅 캘린더" description="새로운 벽과 세팅 일정을 미리 확인하세요" />
                <div className="flex items-center gap-4 rounded-2xl bg-neutral-950 px-4 py-4 text-white">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10"><NotebookPen size={22} /></span>
                  <span><b className="block text-sm">등반 기록</b><span className="mt-1 block text-xs text-neutral-400">로그인하면 완등과 도전을 계속 쌓을 수 있어요</span></span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="text-center text-xs text-neutral-500 sm:text-left">암장 탐색과 세팅 일정은 로그인 없이 이용할 수 있어요.</footer>
      </div>
    </main>
  );
}

function FeatureLink({ to, icon, title, description }: { to: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link to={to} className="group flex min-h-20 items-center gap-4 rounded-2xl border border-neutral-100 bg-white px-4 py-3 transition hover:border-teal-200 hover:bg-teal-50/50">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-100">{icon}</span>
      <span className="min-w-0 flex-1"><b className="block text-sm text-neutral-900">{title}</b><span className="mt-1 block text-xs leading-5 text-neutral-500">{description}</span></span>
      <ChevronRight className="shrink-0 text-neutral-300 group-hover:text-teal-600" size={18} />
    </Link>
  );
}
