let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

function headersFor(options: ApiRequestOptions) {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (options.auth !== false && accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  return headers;
}

async function parseError(response: Response) {
  try {
    const payload = await response.json() as { error?: { code?: string; message?: string } };
    return new ApiClientError(
      response.status,
      payload.error?.code ?? `HTTP_${response.status}`,
      payload.error?.message ?? 'API 요청을 처리하지 못했습니다.',
    );
  } catch {
    return new ApiClientError(response.status, `HTTP_${response.status}`, 'API 요청을 처리하지 못했습니다.');
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          accessToken = null;
          return null;
        }

        const payload = await response.json() as { data: { accessToken: string } };
        accessToken = payload.data.accessToken;
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: options.credentials ?? 'include',
    headers: headersFor(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 401 && options.auth !== false && options.retryOnUnauthorized !== false) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
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
