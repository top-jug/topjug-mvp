import { useRef } from 'react';
import { Navigate, useNavigate } from 'react-router';
import RecordScreen from '../../features/record/RecordScreen';
import { useRecordDraft } from '../providers/RecordDraftProvider';

export default function RecordPage() {
  const navigate = useNavigate();
  const { draft, clearDraft } = useRecordDraft();
  const submittedRef = useRef(false);

  if (!draft) {
    return <Navigate to={submittedRef.current ? '/schedule' : '/record/start'} replace />;
  }

  const handleClose = () => {
    if (submittedRef.current) {
      navigate('/schedule', { replace: true });
      return;
    }

    if (window.history.length > 2) {
      navigate(-2);
      return;
    }

    navigate('/', { replace: true });
  };

  return (
    <RecordScreen
      onClose={handleClose}
      initialDraft={draft}
      onSubmitComplete={() => {
        submittedRef.current = true;
        navigate('/schedule', { replace: true });
        clearDraft();
      }}
    />
  );
}
