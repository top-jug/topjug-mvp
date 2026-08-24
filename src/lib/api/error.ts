export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId: string | null = null,
    readonly retryAfter: string | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiClientError';
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}
