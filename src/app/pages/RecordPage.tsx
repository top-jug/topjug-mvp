import { Navigate, useNavigate } from 'react-router';
import RecordScreen from '../../features/record/RecordScreen';
import { useRecordDraft } from '../providers/RecordDraftProvider';
import { useRecordHistory } from '../providers/RecordHistoryProvider';

export default function RecordPage() {
  const navigate = useNavigate();
  const { draft, clearDraft } = useRecordDraft();
  const { addRecord } = useRecordHistory();

  if (!draft) {
    return <Navigate to="/record/start" replace />;
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
        addRecord(record);
        navigate('/records', { replace: true });
        clearDraft();
      }}
    />
  );
}
