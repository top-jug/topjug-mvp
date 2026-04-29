import { useNavigate } from 'react-router';
import RecordScreen from '../../features/record/RecordScreen';
import { useAppScreenNavigate } from '../navigation';

export default function RecordPage() {
  const navigate = useNavigate();
  const navigateToScreen = useAppScreenNavigate();

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/', { replace: true });
  };

  return <RecordScreen onClose={handleClose} onManageMemberships={() => navigateToScreen('membership')} />;
}
