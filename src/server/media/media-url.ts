import 'server-only';

export function publicMediaUrl(storageKey: string) {
  const baseUrl = process.env.MEDIA_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl) return null;
  return `${baseUrl}/${storageKey.split('/').map(encodeURIComponent).join('/')}`;
}
