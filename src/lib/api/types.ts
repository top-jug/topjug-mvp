export type ApiAuthMode = 'none' | 'optional' | 'required';

export type ApiRequestOptions = RequestInit & {
  auth?: ApiAuthMode;
};

export type ApiDataResponse<T> = {
  data: T;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};
