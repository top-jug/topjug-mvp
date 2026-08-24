import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import RecordScreen from '../../features/record/RecordScreen';
import { getActiveRecordSession } from '../api/record-api';
import { recordDraftFromActiveSession, useRecordDraft } from '../providers/RecordDraftProvider';
import { useRecordHistory } from '../providers/RecordHistoryProvider';
import { useMemberships } from '../providers/MembershipProvider';

export default function RecordPage() {
  const navigate = useNavigate();
  const { draft, setDraft, clearDraft } = useRecordDraft();
  const { addRecord } = useRecordHistory();
  const { refreshMemberships } = useMemberships();
  const submittedRef = useRef(false);
  const [isRecovering, setIsRecovering] = useState(!draft);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    if (draft) {
      setIsRecovering(false);
      return;
    }

    let cancelled = false;
    setIsRecovering(true);
    getActiveRecordSession()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data) {
          navigate(submittedRef.current ? '/records' : '/record/start', { replace: true });
          return;
        }
        setDraft(recordDraftFromActiveSession(data));
      })
      .catch((error) => {
        if (!cancelled) setRecoveryError(error instanceof Error ? error.message : '진행 기록을 복구하지 못했어요.');
      })
      .finally(() => {
        if (!cancelled) setIsRecovering(false);
      });

    return () => { cancelled = true; };
  }, [draft, navigate, setDraft]);

  const handleClose = () => {
    clearDraft();
    navigate('/', { replace: true });
  };

  if (isRecovering) {
    return <div className="flex min-h-screen items-center justify-center bg-white text-[15px] text-neutral-500">진행 중인 기록을 복구하고 있어요…</div>;
  }

  if (recoveryError || !draft) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-[15px] text-red-700">{recoveryError ?? '진행 중인 기록이 없어요.'}</p>
        <button onClick={() => navigate('/record/start', { replace: true })} className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white">기록 시작으로 이동</button>
      </div>
    );
  }

  return (
    <RecordScreen
      onClose={handleClose}
      initialDraft={draft}
      onSubmitComplete={async (record) => {
        submittedRef.current = true;
        addRecord(record);
        await refreshMemberships().catch(() => undefined);
        clearDraft();
        navigate('/records', { replace: true });
      }}
    />
  );
}
