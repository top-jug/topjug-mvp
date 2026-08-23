import GymDetailScreen from '../../features/gym-detail/GymDetailScreen';
import { Navigate, useParams } from 'react-router';
import { useNavigateBack } from '../navigation';

export default function GymDetailPage() {
  const navigateBack = useNavigateBack('/gyms');
  const { gymId } = useParams();

  if (!gymId) return <Navigate to="/gyms" replace />;
  return <GymDetailScreen gymId={gymId} onClose={navigateBack} />;
}
