export type HomeDataState = 'loading' | 'empty' | 'error' | 'ready';
export type RetainedHomeDataState = HomeDataState | 'refreshing' | 'stale';

export function getHomeDataState(isLoading: boolean, error: string | null, itemCount: number): HomeDataState {
  if (isLoading) return 'loading';
  if (error) return 'error';
  return itemCount > 0 ? 'ready' : 'empty';
}

export function getRetainedHomeDataState(
  isLoading: boolean,
  error: string | null,
  itemCount: number,
  hasLoaded: boolean,
): RetainedHomeDataState {
  if (!hasLoaded) return getHomeDataState(isLoading, error, itemCount);
  if (isLoading) return 'refreshing';
  if (error) return 'stale';
  return itemCount > 0 ? 'ready' : 'empty';
}
