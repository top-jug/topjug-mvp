import { ArrowLeft, CalendarDays } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { OperationsSettingSectorManager } from './OperationsSettingSectorManager';

const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';

export function OperationsSettingSectors() {
  const { gymId = '' } = useParams();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={`/ops/gyms/${gymId}`} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-blue-600"><ArrowLeft className="h-4 w-4" />암장 정보</Link>
          <h2 className="mt-3 text-2xl font-black">세팅 구역 관리</h2>
          <p className="mt-1 text-sm text-slate-500">이 암장에서 실제로 사용하는 벽·구역 이름을 관리합니다.</p>
        </div>
        <Link to={`/ops/gyms/${gymId}/setting-events`} className={`${buttonClass} border border-blue-200 bg-blue-50 text-blue-700`}><CalendarDays className="h-4 w-4" />세팅 일정 관리</Link>
      </div>

      <OperationsSettingSectorManager gymId={gymId} />
    </div>
  );
}
