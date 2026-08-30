import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiClientError } from '../api/api-client';
import { ApiPublicShare, getPublicShare, mapPublicShareToRecord } from '../api/record-api';
import { getRecordTotals } from '../../features/record/record-summary';

export default function PublicRecordSharePage() {
  const { token } = useParams();
  const [share, setShare] = useState<ApiPublicShare | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!token) return;

    let isActive = true;
    setIsLoading(true);
    setError(null);

    getPublicShare(token)
      .then((payload) => {
        if (!isActive) return;
        setShare(payload.data);
      })
      .catch((fetchError) => {
        if (!isActive) return;
        setError(publicShareError(fetchError));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  const record = useMemo(() => share ? mapPublicShareToRecord(share) : null, [share]);
  const totals = record ? getRecordTotals(record) : { success: 0, attempt: 0 };
  const completionRate = Math.round((totals.success / Math.max(1, totals.attempt)) * 100);

  if (!token || error) {
    return (
      <ShareState
        title={error?.title ?? '공유 링크를 열 수 없어요'}
        message={error?.message ?? '링크 주소를 다시 확인해주세요.'}
      />
    );
  }

  if (isLoading || !record || !share) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] px-5 py-8 text-neutral-950">
        <main className="mx-auto max-w-md space-y-4">
          <div className="h-[72px] animate-pulse rounded-3xl bg-white" />
          <div className="aspect-[4/5] animate-pulse rounded-[28px] bg-white" />
          <div className="h-[128px] animate-pulse rounded-3xl bg-white" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-5 py-8 text-neutral-950">
      <main className="mx-auto max-w-md space-y-5">
        <header>
          <div className="text-[12px] font-black tracking-[0.12em] text-blue-600">TOPJUG SHARE</div>
          <h1 className="mt-2 text-[26px] font-black tracking-[-0.03em]">{record.gym}</h1>
          <div className="mt-1 text-[13px] text-neutral-500">{record.date} · {record.duration}</div>
        </header>

        {share.media?.url ? (
          <img
            src={share.media.url}
            alt={`${record.gym} 클라이밍 공유 이미지`}
            className="aspect-[4/5] w-full rounded-[28px] border border-neutral-200 bg-white object-cover shadow-lg shadow-neutral-900/10"
          />
        ) : (
          <section className="aspect-[4/5] rounded-[28px] border border-neutral-200 bg-white p-6 shadow-lg shadow-neutral-900/10">
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="text-[12px] font-black tracking-[0.12em] text-blue-600">CLIMB LOG</div>
                <h2 className="mt-3 text-[27px] font-black leading-tight tracking-[-0.04em]">{record.gym}</h2>
                <div className="mt-2 text-[13px] text-neutral-500">{record.date}</div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <PublicStat label="완등" value={totals.success} />
                <PublicStat label="시도" value={totals.attempt} />
                <PublicStat label="완등률" value={completionRate} suffix="%" />
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <h2 className="text-[16px] font-bold">기록 정보</h2>
          <dl className="mt-4 divide-y divide-neutral-100">
            <InfoRow label="운동 날짜" value={record.date} />
            <InfoRow label="운동 시간" value={record.duration} />
            <InfoRow label="이용 방식" value={record.passLabel} />
            <InfoRow label="기록 방식" value={record.mode === 'easy' ? '이지 모드' : '섹터별 기록'} />
            <InfoRow label="난이도 평가" value={record.rating === null ? '미평가' : `${record.rating} / 5`} />
          </dl>
        </section>

        <Link to="/" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-950 text-[14px] font-bold text-white">
          TopJug 열기
          <ExternalLink size={17} />
        </Link>
      </main>
    </div>
  );
}

function PublicStat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-3 py-4 text-center">
      <div className="text-[22px] font-black">{value}{suffix}</div>
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

function ShareState({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-[#F7F8FA] px-5 pb-10 pt-28 text-center text-neutral-950">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[22px] font-black text-neutral-300 shadow-sm">!</div>
      <h1 className="mt-5 text-[20px] font-black">{title}</h1>
      <p className="mt-2 text-[13px] leading-5 text-neutral-500">{message}</p>
      <Link to="/" className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl bg-neutral-950 px-5 text-[14px] font-bold text-white">
        홈으로 이동
      </Link>
    </div>
  );
}

function publicShareError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 410 || error.code === 'SHARE_EXPIRED') {
      return { title: '만료된 공유 링크예요', message: '공유 가능 시간이 지나 더 이상 기록을 볼 수 없습니다.' };
    }

    if (error.code === 'SHARE_NOT_FOUND') {
      return { title: '사용할 수 없는 공유 링크예요', message: '존재하지 않거나 폐기된 공유 링크입니다.' };
    }
  }

  return {
    title: '공유 링크를 불러오지 못했어요',
    message: error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
  };
}
