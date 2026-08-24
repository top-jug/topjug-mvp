import { ApiClientError } from '../../lib/api/error';

export type MembershipResourceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: unknown };

export async function loadMembershipResource<T>(request: () => Promise<T>): Promise<MembershipResourceResult<T>> {
  try {
    return { ok: true, data: await request() };
  } catch (error) {
    return { ok: false, error };
  }
}

export interface MembershipAccountState<TMembership, TGymOption> {
  accountId: string | null;
  memberships: TMembership[];
  gymOptions: TGymOption[];
  isLoading: boolean;
  hasLoadedMemberships: boolean;
  error: string | null;
  isGymOptionsLoading: boolean;
  gymOptionsError: string | null;
  actionError: string | null;
}

export function emptyMembershipAccountState<TMembership = never, TGymOption = never>(
  accountId: string | null,
  isLoading: boolean,
): MembershipAccountState<TMembership, TGymOption> {
  return {
    accountId,
    memberships: [],
    gymOptions: [],
    isLoading,
    hasLoadedMemberships: false,
    error: null,
    isGymOptionsLoading: isLoading,
    gymOptionsError: null,
    actionError: null,
  };
}

export function membershipDataAfterFailure<T>(memberships: T[], hasLoadedMemberships: boolean, error: unknown) {
  return error instanceof ApiClientError && error.status === 401
    ? { memberships: [] as T[], hasLoadedMemberships: false }
    : { memberships, hasLoadedMemberships };
}

export function membershipStateForAccount<TMembership, TGymOption>(
  state: MembershipAccountState<TMembership, TGymOption>,
  accountId: string | null,
) {
  return state.accountId === accountId
    ? state
    : emptyMembershipAccountState<TMembership, TGymOption>(accountId, true);
}
