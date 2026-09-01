import 'server-only';

import { ApiError } from '../http/api-error';
import { MAX_IMAGE_INPUT_BYTES } from './image-processing';

export const MAX_MEDIA_MULTIPART_BODY_BYTES = MAX_IMAGE_INPUT_BYTES + 64 * 1024;

async function readLimitedBody(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new ApiError(400, 'INVALID_MULTIPART_BODY', '업로드 요청 크기를 확인할 수 없습니다.');
    }
    if (parsedLength > MAX_MEDIA_MULTIPART_BODY_BYTES) {
      throw new ApiError(413, 'REQUEST_TOO_LARGE', '업로드 요청 본문이 너무 큽니다.');
    }
  }
  if (!request.body) throw new ApiError(400, 'INVALID_MULTIPART_BODY', '업로드 요청 본문이 비어 있습니다.');

  const chunks: Uint8Array[] = [];
  const reader = request.body.getReader();
  let bytesRead = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > MAX_MEDIA_MULTIPART_BODY_BYTES) {
      await reader.cancel();
      throw new ApiError(413, 'REQUEST_TOO_LARGE', '업로드 요청 본문이 너무 큽니다.');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readImageUpload(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^multipart\/form-data\s*;\s*boundary=.+$/i.test(contentType)) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'multipart/form-data 형식으로 이미지를 보내주세요.');
  }

  try {
    const body = await readLimitedBody(request);
    const formRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    });
    const formData = await formRequest.formData();
    if ([...formData.keys()].some((key) => key !== 'file')) {
      throw new ApiError(400, 'INVALID_MULTIPART_BODY', 'file 필드 하나만 보낼 수 있습니다.');
    }
    const files = formData.getAll('file');
    if (files.length !== 1 || typeof files[0] === 'string') {
      throw new ApiError(400, 'INVALID_MULTIPART_BODY', 'file 필드에 이미지 하나를 보내주세요.');
    }
    if (files[0].size > MAX_IMAGE_INPUT_BYTES) {
      throw new ApiError(413, 'IMAGE_TOO_LARGE', '이미지는 최대 10 MiB까지 업로드할 수 있습니다.');
    }
    return {
      body: Buffer.from(await files[0].arrayBuffer()),
      declaredContentType: files[0].type,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'INVALID_MULTIPART_BODY', 'multipart 업로드 요청을 읽을 수 없습니다.');
  }
}
