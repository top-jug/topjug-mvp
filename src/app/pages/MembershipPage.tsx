import { useNavigate } from 'react-router';
import MembershipScreen from '../../features/membership/MembershipScreen';
import { useMemberships } from '../providers/MembershipProvider';

export default function MembershipPage() {
  const navigate = useNavigate();
  const { memberships, addMembership, updateMembership, deleteMembership } = useMemberships();

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/', { replace: true });
  };

  return (
    <MembershipScreen
      memberships={memberships}
      onClose={handleClose}
      onAddMembership={addMembership}
      onUpdateMembership={updateMembership}
      onDeleteMembership={deleteMembership}
    />
  );
}
