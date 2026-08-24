import { apiRequest as sharedApiRequest } from '../../lib/api/client';

export { ApiClientError } from '../../lib/api/error';

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

const API_PREFIX = '/api/v1';

function relativeApiPath(path: string) {
  if (!path.startsWith(`${API_PREFIX}/`)) {
    throw new Error(`API path must start with ${API_PREFIX}/`);
  }
  return path.slice(API_PREFIX.length);
}

export function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth, body, retryOnUnauthorized: _retryOnUnauthorized, ...requestOptions } = options;
  return sharedApiRequest<T>(relativeApiPath(path), {
    ...requestOptions,
    auth: auth === false ? 'none' : 'required',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function queryString(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  const value = query.toString();
  return value ? `?${value}` : '';
}
