import 'server-only';

import { loadSecretsFromSsm } from './load-secrets';

export async function registerNodeRuntime() {
  try {
    await loadSecretsFromSsm();
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'config.startup_failed',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }));
    if (process.env.APP_PROFILE === 'production') process.exit(1);
    throw error;
  }
}
