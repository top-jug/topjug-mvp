import MembershipScreen from '../../features/membership/MembershipScreen';
import { useMemberships } from '../providers/MembershipProvider';
import { useNavigateBack } from '../navigation';

export default function MembershipPage() {
  const navigateBack = useNavigateBack('/profile');
  const { memberships, addMembership, updateMembership, deleteMembership } = useMemberships();

  return (
    <MembershipScreen
      memberships={memberships}
      onClose={navigateBack}
      onAddMembership={addMembership}
      onUpdateMembership={updateMembership}
      onDeleteMembership={deleteMembership}
    />
  );
}
