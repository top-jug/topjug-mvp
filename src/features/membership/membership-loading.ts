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
