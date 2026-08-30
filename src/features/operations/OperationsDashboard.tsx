import { ArrowRight, Building2, CalendarClock, CheckCircle2, ShieldCheck, Tags } from 'lucide-react';
import { Link } from 'react-router';

const workAreas = [
  { title: '암장 정보', description: '기본 정보와 운영 상태를 관리합니다.', path: '/ops/gyms', icon: Building2 },
  { title: '운영 일정', description: '영업시간과 세팅 일정을 관리합니다.', path: '/ops/gyms', icon: CalendarClock },
  { title: '암장 태그', description: '검색과 분류에 쓰는 태그를 관리합니다.', path: '/ops/gym-tags', icon: Tags },
];

export function OperationsDashboard() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-blue-200">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" /> 운영 관리자 전용
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">TOPJUG 운영 콘솔</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">암장 데이터와 운영 일정을 관리하기 위한 기반 화면입니다. 각 관리 기능은 이 콘솔에 순차적으로 연결됩니다.</p>
        </div>
      </section>

      <section aria-labelledby="work-areas-title">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Workspace</p>
            <h2 id="work-areas-title" className="mt-1 text-xl font-black tracking-tight">운영 작업</h2>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">기반 준비 완료</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workAreas.map(({ title, description, path, icon: Icon }) => (
            <Link key={title} to={path} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon aria-hidden="true" className="h-5 w-5" /></div>
                <ArrowRight aria-hidden="true" className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
              </div>
              <h3 className="mt-5 font-black text-slate-950">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-blue-950">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div>
          <h2 className="text-sm font-black">이번 이슈의 범위</h2>
          <p className="mt-1 text-sm leading-6 text-blue-900/70">권한 검증과 반응형 콘솔 셸만 제공합니다. 암장 변경, 사진 업로드, 공지사항, 실제 알림 전송은 아직 활성화되지 않았습니다.</p>
        </div>
      </section>
    </div>
  );
}
