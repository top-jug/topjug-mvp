import 'server-only';

export function getClientAddress(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwardedFor || request.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}
