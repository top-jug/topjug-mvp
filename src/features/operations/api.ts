import { apiRequest } from '../../lib/api/client';
import type { ApiDataResponse } from '../../lib/api/types';

export type OperationsSession = {
  userId: string;
  role: 'operations_admin';
};

export async function verifyOperationsSession(signal?: AbortSignal) {
  const response = await apiRequest<ApiDataResponse<OperationsSession>>('/ops/session', { signal });
  return response.data;
}
