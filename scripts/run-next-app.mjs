import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [appName, command, ...args] = process.argv.slice(2);

if (!['web', 'admin'].includes(appName) || !['dev', 'build', 'start'].includes(command)) {
  console.error('Usage: run-next-app.mjs <web|admin> <dev|build|start> [...args]');
  process.exit(1);
}

const localEnvironment = path.join(repoRoot, '.env.local');
if (existsSync(localEnvironment)) process.loadEnvFile(localEnvironment);

const nextCli = path.join(repoRoot, 'node_modules/next/dist/bin/next');
const child = spawn(process.execPath, [nextCli, command, ...args], {
  cwd: path.join(repoRoot, 'apps', appName),
  env: process.env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal));
}

child.once('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
