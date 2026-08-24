export type HomeDataState = 'loading' | 'empty' | 'error' | 'ready';

export function getHomeDataState(isLoading: boolean, error: string | null, itemCount: number): HomeDataState {
  if (isLoading) return 'loading';
  if (error) return 'error';
  return itemCount > 0 ? 'ready' : 'empty';
}
