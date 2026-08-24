import { Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ClimbingRecord } from '../../entities/record/types';
import { getRecordTotals } from '../../features/record/record-summary';
import { RECORD_DIFFICULTIES } from '../../mocks/record';
import { getRecord as fetchRecord, mapApiRecordDetail } from '../api/record-api';
import { useNavigateBack } from '../navigation';

const SECTOR_LABELS: Record<string, string> = {
  easy: '이지 모드',
  sector1: '1 Sector (Main Wall)',
  sector2: '2 Sector (Cave)',
};

interface RouteDetail {
  key: string;
  sector: string;
  difficulty?: {
    color: string;
    name: string;
    grade: string;
    hexColor?: string | null;
  };
  success: number;
  attempt: number;
}

function getRouteDetails(record: ClimbingRecord): RouteDetail[] {
  if (record.apiCounts?.length) {
    return record.apiCounts
      .filter((counts) => counts.success > 0 || counts.attempt > 0)
      .map((counts) => ({
        key: counts.id,
        sector: `${counts.wallName} · ${counts.sectorName}`,
        difficulty: {
          color: '',
          name: counts.gradeCode,
          grade: counts.gradeLabel,
          hexColor: counts.gradeColor,
        },
        success: counts.success,
        attempt: counts.attempt,
      }));
  }

  return Object.entries(record.routeCounts)
    .filter(([, counts]) => counts.success > 0 || counts.attempt > 0)
    .map(([key, counts]) => {
      const separatorIndex = key.lastIndexOf('-');
      const sectorId = key.slice(0, separatorIndex);
      const difficultyIndex = Number(key.slice(separatorIndex + 1));

      return {
        key,
        sector: SECTOR_LABELS[sectorId] ?? sectorId,
        difficulty: RECORD_DIFFICULTIES[difficultyIndex],
        ...counts,
      };
    });
}

export default function RecordResultPage() {
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/records');
  const { recordId } = useParams();
  const [record, setRecord] = useState<ClimbingRecord | undefined>();
  const [isLoading, setIsLoading] = useState(Boolean(recordId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) return;

    let isActive = true;
    setRecord(undefined);
    setIsLoading(true);
    setError(null);

    fetchRecord(recordId)
      .then((payload) => {
        if (!isActive) return;
        setRecord(mapApiRecordDetail(payload.data));
      })
      .catch((fetchError) => {
        if (!isActive) return;
        setError(fetchError instanceof Error ? fetchError.message : '기록을 불러오지 못했어요.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [recordId]);

  if (!recordId) return <Navigate to="/records" replace />;

  if ((isLoading && !record) || (record && record.id !== recordId)) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] pb-10 text-neutral-950">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-5 py-3">
          <button onClick={navigateBack} className="flex h-11 w-9 items-center" aria-label="뒤로가기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-[18px] font-bold">기록 상세</h1>
          <div className="w-9" />
        </header>
        <main className="space-y-4 px-5 py-5">
          <div className="h-[172px] animate-pulse rounded-3xl border border-neutral-200 bg-white" />
          <div className="h-[260px] animate-pulse rounded-3xl border border-neutral-200 bg-white" />
        </main>
      </div>
    );
  }

  if (error && !record) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] px-5 pb-10 pt-24 text-center text-neutral-950">
        <div className="text-[18px] font-bold">기록을 찾을 수 없어요</div>
        <div className="mt-2 text-[13px] text-neutral-500">{error}</div>
        <button onClick={() => navigate('/records', { replace: true })} className="mt-6 h-12 rounded-2xl bg-neutral-950 px-5 text-[14px] font-bold text-white">
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (!record) return <Navigate to="/records" replace />;

  const totals = getRecordTotals(record);
  const routeDetails = getRouteDetails(record);
  const completionRate = Math.round((totals.success / Math.max(1, totals.attempt)) * 100);

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-10 text-neutral-950">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-5 py-3">
        <button onClick={navigateBack} className="flex h-11 w-9 items-center" aria-label="뒤로가기">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-[18px] font-bold">기록 상세</h1>
        <button onClick={() => navigate(`/records/${record.id}/share`)} className="flex h-11 w-9 items-center justify-end text-blue-600" aria-label="기록 공유하기">
          <Share2 size={21} />
        </button>
      </header>

      <main className="space-y-4 px-5 py-5">
        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-blue-600">CLIMBING RECORD</div>
              <h2 className="mt-2 truncate text-[25px] font-black tracking-[-0.04em]">{record.gym}</h2>
              <div className="mt-1 text-[13px] text-neutral-500">{record.date}</div>
            </div>
            <div className="rounded-full bg-blue-50 px-3 py-1.5 text-[12px] font-bold text-blue-700">
              {record.mode === 'easy' ? '이지 모드' : '섹터 모드'}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <SummaryStat label="완등" value={totals.success} />
            <SummaryStat label="시도" value={totals.attempt} />
            <SummaryStat label="완등률" value={completionRate} suffix="%" />
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <h2 className="text-[16px] font-bold">운동 정보</h2>
          <dl className="mt-4 divide-y divide-neutral-100">
            <InfoRow label="운동 날짜" value={record.date} />
            <InfoRow label="운동 시간" value={record.duration} />
            <InfoRow label="사용 회원권" value={record.passLabel} />
            <InfoRow label="난이도 평가" value={record.rating === null ? '미평가' : `${record.rating} / 5`} />
            <InfoRow label="기록 방식" value={record.mode === 'easy' ? '이지 모드' : '섹터별 기록'} />
            <InfoRow label="기록 완료" value={record.endedAt ? new Date(record.endedAt).toLocaleString('ko-KR') : '-'} />
          </dl>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold">난이도별 기록</h2>
            <span className="text-[12px] text-neutral-400">총 {routeDetails.length}개</span>
          </div>

          {routeDetails.length > 0 ? (
            <div className="mt-4 space-y-3">
              {routeDetails.map((route) => (
                <div key={route.key} className="rounded-2xl bg-neutral-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-neutral-500">{route.sector}</div>
                      <div className="mt-1 flex items-center gap-2 text-[14px] font-bold">
                        <span
                          className={`h-4 w-4 rounded-full ${route.difficulty?.color ?? 'bg-neutral-300'}`}
                          style={route.difficulty?.hexColor ? { backgroundColor: route.difficulty.hexColor } : undefined}
                        />
                        {route.difficulty ? `${route.difficulty.name} (${route.difficulty.grade})` : '난이도 미지정'}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <CountBadge label="완등" value={route.success} color="text-green-700" />
                      <CountBadge label="시도" value={route.attempt} color="text-blue-700" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-8 text-center text-[13px] text-neutral-500">
              난이도별 완등·시도 기록이 없습니다.
            </div>
          )}
        </section>
      </main>

    </div>
  );
}

function SummaryStat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-center">
      <div className="text-[20px] font-black">{value}{suffix}</div>
      <div className="mt-1 text-[11px] text-neutral-500">{label}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-[14px]">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-semibold text-neutral-900">{value}</dd>
    </div>
  );
}

function CountBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="min-w-12 rounded-xl bg-white px-2.5 py-2 text-center">
      <div className={`text-[15px] font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-neutral-400">{label}</div>
    </div>
  );
}
