export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { registerNodeRuntime } = await import('../../src/server/config/register-node-runtime');
  await registerNodeRuntime();
}
