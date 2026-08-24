import { useEffect, useRef } from 'react';
import MembershipScreen from '../../features/membership/MembershipScreen';
import { shouldRefreshForActivation } from '../../features/membership/membership-summary';
import { useMemberships } from '../providers/MembershipProvider';
import { useNavigateBack } from '../navigation';

export default function MembershipPage() {
  const navigateBack = useNavigateBack('/profile');
  const {
    memberships,
    gymOptions,
    isLoading,
    error,
    isGymOptionsLoading,
    gymOptionsError,
    actionError,
    refreshMemberships,
    refreshGymOptions,
    refreshMembershipPresentation,
    addMembership,
    updateMembership,
    deleteMembership,
  } = useMemberships();
  const lastActivationRefresh = useRef(0);

  useEffect(() => {
    const refreshOnActivation = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (!shouldRefreshForActivation(lastActivationRefresh.current, now)) return;
      lastActivationRefresh.current = now;
      refreshMembershipPresentation();
      void refreshMemberships();
      void refreshGymOptions();
    };

    // Let the provider's auth/account effect establish its generation first on a direct route entry.
    const entryRefresh = window.setTimeout(refreshOnActivation, 0);
    window.addEventListener('focus', refreshOnActivation);
    document.addEventListener('visibilitychange', refreshOnActivation);
    return () => {
      window.clearTimeout(entryRefresh);
      window.removeEventListener('focus', refreshOnActivation);
      document.removeEventListener('visibilitychange', refreshOnActivation);
    };
  }, [refreshGymOptions, refreshMembershipPresentation, refreshMemberships]);

  return (
    <MembershipScreen
      memberships={memberships}
      gymOptions={gymOptions}
      isLoading={isLoading}
      error={error}
      isGymOptionsLoading={isGymOptionsLoading}
      gymOptionsError={gymOptionsError}
      actionError={actionError}
      onRetry={refreshMemberships}
      onRetryGymOptions={refreshGymOptions}
      onClose={navigateBack}
      onAddMembership={addMembership}
      onUpdateMembership={updateMembership}
      onArchiveMembership={deleteMembership}
    />
  );
}
