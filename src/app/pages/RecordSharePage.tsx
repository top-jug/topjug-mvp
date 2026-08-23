import { Clipboard, Download, Share2, X } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { getRecordTotals } from '../../features/record/record-summary';
import { createRecordShareImage } from '../../features/record/record-share-image';
import { useRecordHistory } from '../providers/RecordHistoryProvider';

export default function RecordSharePage() {
  const navigate = useNavigate();
  const { recordId } = useParams();
  const { getRecord } = useRecordHistory();
  const [status, setStatus] = useState('');
  const record = recordId ? getRecord(recordId) : undefined;

  if (!record) return <Navigate to="/records" replace />;

  const totals = getRecordTotals(record);
  const getImageFile = async () => {
    const blob = await createRecordShareImage(record);
    return { blob, file: new File([blob], `topjug-${record.date}.png`, { type: 'image/png' }) };
  };

  const handleSave = async () => {
    try {
      const { blob, file } = await getImageFile();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('이미지를 저장했어요.');
    } catch {
      setStatus('이미지를 저장하지 못했어요.');
    }
  };

  const handleCopy = async () => {
    try {
      const { blob } = await getImageFile();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('이미지를 복사했어요.');
    } catch {
      setStatus('이 브라우저에서는 이미지 복사를 지원하지 않아요.');
    }
  };

  const handleShare = async () => {
    try {
      const { file } = await getImageFile();
      const shareData = { files: [file], title: `${record.gym} 클라이밍 기록`, text: '오늘의 클라이밍 기록 #TopJug' };

      if (!navigator.share || !navigator.canShare?.(shareData)) {
        setStatus('이 브라우저에서는 공유 기능을 지원하지 않아요.');
        return;
      }

      await navigator.share(shareData);
      setStatus('기록을 공유했어요.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus('기록을 공유하지 못했어요.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-5 pb-10 text-white">
      <header className="flex items-center justify-between py-4">
        <div className="text-[14px] font-black tracking-[0.14em]">SHARE YOUR SEND</div>
        <button onClick={() => navigate(`/records/${record.id}`)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10" aria-label="공유 화면 닫기">
          <X size={21} />
        </button>
      </header>

      <main className="mx-auto max-w-md">
        <section className="relative aspect-[4/5] overflow-hidden rounded-[34px] bg-gradient-to-br from-[#2C214D] via-[#17131F] to-[#795CFF] p-7 shadow-2xl shadow-violet-950/50">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#A7F432]" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#FF6B9D]/90" />
          <div className="relative flex h-full flex-col">
            <div className="text-[11px] font-bold tracking-[0.18em] text-white/60">TOPJUG / CLIMB LOG</div>
            <h1 className="mt-12 max-w-[280px] text-[34px] font-black leading-tight tracking-[-0.04em]">{record.gym}</h1>
            <div className="mt-2 text-[13px] text-white/60">{record.date} · {record.duration}</div>

            <div className="mt-auto grid grid-cols-3 gap-2 rounded-3xl bg-white/10 p-4 backdrop-blur">
              <ShareStat label="SEND" value={totals.success} />
              <ShareStat label="TRY" value={totals.attempt} />
              <ShareStat label="FEEL" value={record.rating} suffix="/5" />
            </div>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="text-[14px] font-black text-[#A7F432]">{record.mode === 'easy' ? 'EASY MODE' : 'SECTOR MODE'}</div>
                <div className="mt-1 text-[12px] text-white/60">KEEP MOVING.</div>
              </div>
              <div className="text-[11px] font-bold text-white/50">topjug.kr</div>
            </div>
          </div>
        </section>

        <div className="mt-7 grid grid-cols-3 gap-5">
          <ActionButton label="저장" icon={<Download size={22} />} onClick={handleSave} />
          <ActionButton label="복사" icon={<Clipboard size={21} />} onClick={handleCopy} />
          <ActionButton label="공유" icon={<Share2 size={21} />} onClick={handleShare} />
        </div>
        <div className="mt-4 min-h-5 text-center text-[12px] text-white/60" role="status">{status}</div>
      </main>
    </div>
  );
}

function ShareStat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="text-[25px] font-black">{value}{suffix}</div>
      <div className="mt-1 text-[10px] font-bold tracking-[0.12em] text-white/45">{label}</div>
    </div>
  );
}

function ActionButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 text-[12px] font-semibold text-white/70">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-neutral-950 shadow-lg active:scale-95">{icon}</span>
      {label}
    </button>
  );
}
