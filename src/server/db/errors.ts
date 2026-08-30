export function databaseErrorCode(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current; depth += 1) {
    if ('code' in current && typeof current.code === 'string') return current.code;
    current = 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}
