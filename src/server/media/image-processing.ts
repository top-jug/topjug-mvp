import 'server-only';

import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ApiError } from '../http/api-error';

export const MAX_IMAGE_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_INPUT_PIXELS = 40_000_000;
export const MAX_IMAGE_INPUT_DIMENSION = 12_000;
export const MAX_IMAGE_OUTPUT_DIMENSION = 2_560;
export const MAX_IMAGE_OUTPUT_BYTES = 10 * 1024 * 1024;
export const IMAGE_OUTPUT_CONTENT_TYPE = 'image/webp';

const supportedFormats = new Map([
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
]);

export interface ProcessedImage {
  body: Buffer;
  contentType: typeof IMAGE_OUTPUT_CONTENT_TYPE;
  byteSize: number;
  checksumSha256: string;
  width: number;
  height: number;
}

function invalidImage(message: string) {
  return new ApiError(400, 'INVALID_IMAGE', message);
}

export async function processImage(input: Buffer, declaredContentType: string): Promise<ProcessedImage> {
  if (input.byteLength === 0) throw invalidImage('이미지 파일이 비어 있습니다.');
  if (input.byteLength > MAX_IMAGE_INPUT_BYTES) {
    throw new ApiError(413, 'IMAGE_TOO_LARGE', '이미지는 최대 10 MiB까지 업로드할 수 있습니다.');
  }

  try {
    const image = sharp(input, {
      animated: false,
      failOn: 'warning',
      limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    const detectedContentType = metadata.format ? supportedFormats.get(metadata.format) : undefined;
    if (!detectedContentType) throw invalidImage('JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.');
    if (declaredContentType.toLowerCase() !== detectedContentType) {
      throw invalidImage('파일 내용과 MIME 형식이 일치하지 않습니다.');
    }
    if (!metadata.width || !metadata.height) throw invalidImage('이미지 크기를 확인할 수 없습니다.');
    if (metadata.width > MAX_IMAGE_INPUT_DIMENSION || metadata.height > MAX_IMAGE_INPUT_DIMENSION) {
      throw invalidImage('이미지의 가로와 세로는 각각 12000px 이하여야 합니다.');
    }
    if ((metadata.pages ?? 1) !== 1) throw invalidImage('움직이는 이미지는 업로드할 수 없습니다.');

    const { data, info } = await image
      .rotate()
      .resize({
        width: MAX_IMAGE_OUTPUT_DIMENSION,
        height: MAX_IMAGE_OUTPUT_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });

    if (data.byteLength > MAX_IMAGE_OUTPUT_BYTES) {
      throw new ApiError(413, 'IMAGE_TOO_LARGE', '변환된 이미지가 저장 가능한 크기를 초과합니다.');
    }

    return {
      body: data,
      contentType: IMAGE_OUTPUT_CONTENT_TYPE,
      byteSize: data.byteLength,
      checksumSha256: createHash('sha256').update(data).digest('hex'),
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw invalidImage('손상되었거나 안전하게 처리할 수 없는 이미지입니다.');
  }
}
