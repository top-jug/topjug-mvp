import { useRef } from 'react';
import { Navigate, useNavigate } from 'react-router';
import RecordScreen from '../../features/record/RecordScreen';
import { useRecordDraft } from '../providers/RecordDraftProvider';
import { useRecordHistory } from '../providers/RecordHistoryProvider';

export default function RecordPage() {
  const navigate = useNavigate();
  const { draft, clearDraft } = useRecordDraft();
  const { addRecord } = useRecordHistory();
  const submittedRef = useRef(false);

  if (!draft) {
    return <Navigate to={submittedRef.current ? '/records' : '/record/start'} replace />;
  }

  const handleClose = () => {
    clearDraft();
    navigate('/', { replace: true });
  };

  return (
    <RecordScreen
      onClose={handleClose}
      initialDraft={draft}
      onSubmitComplete={(record) => {
        submittedRef.current = true;
        addRecord(record);
        clearDraft();
        navigate('/records', { replace: true });
      }}
    />
  );
}
