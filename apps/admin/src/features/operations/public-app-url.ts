const configuredOrigin = process.env.NEXT_PUBLIC_TOPJUG_WEB_ORIGIN?.replace(/\/$/, '');

function defaultOrigin() {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  return 'https://topjug.kr';
}

export function publicAppUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${configuredOrigin || defaultOrigin()}${normalizedPath}`;
}
