import { spawn } from 'node:child_process';

const hostname = '127.0.0.1';
const port = '3100';
const server = spawn(process.execPath, ['apps/web/.next/standalone/apps/web/server.js'], {
  env: { ...process.env, HOSTNAME: hostname, PORT: port },
  stdio: 'inherit',
});

async function waitUntilReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Standalone server exited with code ${server.exitCode}`);
    try {
      const response = await fetch(`http://${hostname}:${port}/api/ready`);
      if (response.ok) return;
    } catch {
      // The server may still be binding its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Standalone server did not become ready');
}

function runTests() {
  return new Promise((resolve, reject) => {
    const tests = spawn(process.execPath, [
      '--conditions=react-server',
      '--import',
      'tsx',
      '--test',
      'tests/server/api.http.test.ts',
    ], {
      env: { ...process.env, API_BASE_URL: `http://${hostname}:${port}/api/v1` },
      stdio: 'inherit',
    });
    tests.once('error', reject);
    tests.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`HTTP tests exited with code ${code}`)));
  });
}

try {
  await waitUntilReady();
  await runTests();
} finally {
  server.kill('SIGTERM');
}
