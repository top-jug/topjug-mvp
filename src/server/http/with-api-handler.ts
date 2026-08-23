import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from './api-error';

type ApiHandler = (request: NextRequest) => Promise<Response> | Response;

export function withApiHandler(handler: ApiHandler): ApiHandler {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status },
        );
      }

      console.error('Unhandled API error', error);
      return NextResponse.json(
        { error: { code: 'INTERNAL_SERVER_ERROR', message: '요청을 처리하지 못했습니다.' } },
        { status: 500 },
      );
    }
  };
}
