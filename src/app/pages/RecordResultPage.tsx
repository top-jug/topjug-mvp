import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ClimbingRecord } from '../../entities/record/types';
import { getRecordTotals } from '../../features/record/record-summary';
import { useRecordHistory } from '../providers/RecordHistoryProvider';

function drawShareImage(record: ClimbingRecord) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Canvas is not available');

  const totals = getRecordTotals(record);
  const gradient = context.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#121212');
  gradient.addColorStop(0.55, '#241A45');
  gradient.addColorStop(1, '#795CFF');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1350);

  context.fillStyle = '#A7F432';
  context.beginPath();
  context.arc(920, 180, 220, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#FF6B9D';
  context.beginPath();
  context.arc(100, 1260, 260, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#FFFFFF';
  context.font = '700 46px sans-serif';
  context.fillText('TOPJUG / CLIMB LOG', 72, 100);
  context.font = '900 92px sans-serif';
  context.fillText(record.gym, 72, 310);
  context.font = '500 34px sans-serif';
  context.fillStyle = 'rgba(255,255,255,0.72)';
  context.fillText(`${record.date}  ·  ${record.duration}`, 76, 375);

  context.fillStyle = 'rgba(255,255,255,0.10)';
  context.beginPath();
  context.roundRect(64, 470, 952, 520, 52);
  context.fill();

  const stats = [
    ['SEND', String(totals.success)],
    ['TRY', String(totals.attempt)],
    ['FEEL', `${record.rating}/5`],
  ];

  stats.forEach(([label, value], index) => {
    const x = 115 + index * 315;
    context.fillStyle = '#FFFFFF';
    context.font = '900 104px sans-serif';
    context.fillText(value, x, 700);
    context.fillStyle = 'rgba(255,255,255,0.58)';
    context.font = '700 30px sans-serif';
    context.fillText(label, x, 755);
  });

  context.fillStyle = '#A7F432';
  context.font = '800 42px sans-serif';
  context.fillText(record.mode === 'easy' ? 'EASY MODE' : 'SECTOR MODE', 112, 900);
  context.fillStyle = '#FFFFFF';
  context.font = '700 34px sans-serif';
  context.fillText(record.passLabel, 112, 955);
  context.font = '900 58px sans-serif';
  context.fillText('KEEP MOVING.', 72, 1190);
  context.fillStyle = 'rgba(255,255,255,0.62)';
  context.font = '500 28px sans-serif';
  context.fillText('topjug.kr', 76, 1245);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image creation failed'))), 'image/png');
  });
}

export default function RecordResultPage() {
  const navigate = useNavigate();
  const { recordId } = useParams();
  const { getRecord } = useRecordHistory();
  const [shareStatus, setShareStatus] = useState('');
  const record = recordId ? getRecord(recordId) : undefined;

  if (!record) return <Navigate to="/records" replace />;

  const totals = getRecordTotals(record);

  const handleShare = async () => {
    try {
      const blob = await drawShareImage(record);
      const file = new File([blob], `topjug-${record.date}.png`, { type: 'image/png' });
      const shareData = { files: [file], title: `${record.gym} 클라이밍 기록`, text: '오늘의 클라이밍 기록 #TopJug' };

      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setShareStatus('공유했어요.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setShareStatus('이미지를 저장했어요.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareStatus('이미지를 만들지 못했어요. 다시 시도해주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 pb-10 text-white">
      <header className="flex items-center justify-between px-5 py-4">
        <button onClick={() => navigate('/records')} className="flex h-11 w-8 items-center" aria-label="내 기록으로 돌아가기">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="text-[14px] font-bold tracking-[0.12em]">CLIMB LOG</div>
        <div className="w-8" />
      </header>

      <main className="px-5">
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#2C214D] via-[#17131F] to-[#795CFF] p-6 shadow-2xl">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#A7F432]" />
          <div className="absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-[#FF6B9D]/80" />
          <div className="relative">
            <div className="text-[12px] font-bold tracking-[0.16em] text-white/60">TOPJUG / RESULT</div>
            <h1 className="mt-12 max-w-[260px] text-[34px] font-black leading-tight tracking-[-0.04em]">{record.gym}</h1>
            <div className="mt-2 text-[13px] text-white/60">{record.date} · {record.duration}</div>

            <div className="mt-10 grid grid-cols-3 gap-2 rounded-3xl bg-white/10 p-4 backdrop-blur">
              <ResultStat label="완등" value={totals.success} />
              <ResultStat label="시도" value={totals.attempt} />
              <ResultStat label="체감" value={record.rating} suffix="/5" />
            </div>

            <div className="mt-6 flex items-end justify-between">
              <div>
                <div className="text-[12px] text-white/50">기록 모드</div>
                <div className="mt-1 text-[16px] font-bold text-[#A7F432]">{record.mode === 'easy' ? '이지 모드' : '섹터 모드'}</div>
              </div>
              <div className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-semibold">{record.passLabel}</div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl bg-white p-5 text-neutral-950">
          <div className="text-[13px] text-neutral-500">오늘의 한 줄</div>
          <div className="mt-2 text-[20px] font-black tracking-[-0.03em]">KEEP MOVING. 다음 홀드까지.</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-[#795CFF]" style={{ width: `${Math.min(100, (totals.success / Math.max(1, totals.attempt)) * 100)}%` }} />
          </div>
          <div className="mt-2 text-right text-[11px] text-neutral-400">완등률 {Math.round((totals.success / Math.max(1, totals.attempt)) * 100)}%</div>
        </section>

        <button onClick={handleShare} className="mt-5 w-full rounded-2xl bg-[#A7F432] py-4 text-[16px] font-black text-neutral-950 active:scale-[0.99]">
          이미지로 공유하기
        </button>
        {shareStatus && <div className="mt-3 text-center text-[12px] text-white/60" role="status">{shareStatus}</div>}
      </main>
    </div>
  );
}

function ResultStat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="text-[24px] font-black">{value}{suffix}</div>
      <div className="mt-1 text-[11px] text-white/50">{label}</div>
    </div>
  );
}
