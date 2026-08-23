import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from './api-error';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { logger } from '../observability/logger';
import { runWithRequestContext } from '../observability/request-context';

type ApiHandler<Context = unknown> = (request: NextRequest, context: Context) => Promise<Response> | Response;

export function withApiHandler<Context = unknown>(handler: ApiHandler<Context>): ApiHandler<Context> {
  return async (request, context) => {
    const incomingRequestId = request.headers.get('x-request-id');
    const requestId = z.string().uuid().safeParse(incomingRequestId).success ? incomingRequestId! : randomUUID();
    const startedAt = performance.now();

    return runWithRequestContext({ requestId }, async () => {
      logger.info('http.request_started', { method: request.method, path: request.nextUrl.pathname });

      try {
        const response = await handler(request, context);
        response.headers.set('x-request-id', requestId);
        response.headers.set('Cache-Control', 'no-store');
        logger.info('http.request_completed', {
          method: request.method,
          path: request.nextUrl.pathname,
          status: response.status,
          durationMs: Math.round(performance.now() - startedAt),
        });
        return response;
      } catch (error) {
        const apiError = error instanceof ApiError
          ? error
          : new ApiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.');
        logger.error('http.request_failed', {
          method: request.method,
          path: request.nextUrl.pathname,
          status: apiError.status,
          errorCode: apiError.code,
          errorName: error instanceof Error ? error.name : 'UnknownError',
          durationMs: Math.round(performance.now() - startedAt),
        });
        const response = NextResponse.json(
          { error: { code: apiError.code, message: apiError.message } },
          { status: apiError.status },
        );
        response.headers.set('x-request-id', requestId);
        response.headers.set('Cache-Control', 'no-store');
        if (apiError.status === 401) response.headers.set('WWW-Authenticate', 'Bearer');
        if (apiError.status === 429) response.headers.set('Retry-After', '900');
        return response;
      }
    });
  };
}
