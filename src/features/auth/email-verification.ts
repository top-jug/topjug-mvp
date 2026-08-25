export function normalizeVerificationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidVerificationEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeVerificationEmail(email));
}

export function maskEmail(email: string) {
  const normalizedEmail = normalizeVerificationEmail(email);
  const [localPart, domain] = normalizedEmail.split('@');
  if (!localPart || !domain) return normalizedEmail;

  const visiblePart = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePart}${'*'.repeat(Math.max(3, localPart.length - visiblePart.length))}@${domain}`;
}
