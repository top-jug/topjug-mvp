import MembershipScreen from '../../features/membership/MembershipScreen';
import { useMemberships } from '../providers/MembershipProvider';
import { useNavigateBack } from '../navigation';

export default function MembershipPage() {
  const navigateBack = useNavigateBack('/profile');
  const {
    memberships,
    gymOptions,
    isLoading,
    error,
    actionError,
    refreshMemberships,
    addMembership,
    updateMembership,
    deleteMembership,
  } = useMemberships();

  return (
    <MembershipScreen
      memberships={memberships}
      gymOptions={gymOptions}
      isLoading={isLoading}
      error={error}
      actionError={actionError}
      onRetry={refreshMemberships}
      onClose={navigateBack}
      onAddMembership={addMembership}
      onUpdateMembership={updateMembership}
      onArchiveMembership={deleteMembership}
    />
  );
}
