import { closeDatabase } from '../src/server/db/client.ts';
import { registerSchema } from '../src/server/auth/auth-validation.ts';
import { createOperationsAdmin } from '../src/server/auth/operations-admin-service.ts';
import { parseOperationsAdminArguments } from '../src/server/auth/operations-admin-bootstrap.ts';
import { databaseUrl } from './database-url.mjs';

function usage() {
  return [
    'Usage:',
    '  npm run ops:admin:create:local -- --email admin@example.com --display-name "운영자"',
    '  npm run ops:admin:create:local -- --email admin@example.com --display-name "운영자" --apply',
    '',
    'The command is a dry run unless --apply is provided.',
    'Passwords are accepted only through a hidden interactive prompt.',
  ].join('\n');
}

function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error('A TTY is required so the password can be entered securely.');
  }

  process.stdout.write(prompt);
  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';

    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const finish = () => {
      cleanup();
      process.stdout.write('\n');
      resolve(value);
    };
    const cancel = () => {
      cleanup();
      process.stdout.write('\n');
      reject(new Error('Password entry was cancelled.'));
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u0003') {
          cancel();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = [...value].slice(0, -1).join('');
          continue;
        }
        if (character >= ' ' && character !== '\u007f') value += character;
      }
    };

    process.stdin.on('data', onData);
  });
}

async function main() {
  const arguments_ = parseOperationsAdminArguments(process.argv.slice(2));
  if (arguments_.help) {
    console.info(usage());
    return;
  }
  if (!arguments_.email || !arguments_.displayName) throw new Error(`--email and --display-name are required.\n\n${usage()}`);

  const identity = registerSchema.pick({ email: true, displayName: true }).parse({
    email: arguments_.email,
    displayName: arguments_.displayName,
  });

  if (!arguments_.apply) {
    console.info(JSON.stringify({ event: 'operations_admin.create_preview', applyRequired: true }));
    return;
  }

  const password = await readHidden('Password: ');
  const confirmation = await readHidden('Confirm password: ');
  if (password !== confirmation) throw new Error('Password confirmation does not match.');

  const input = registerSchema.parse({ ...identity, password });
  process.env.DATABASE_URL = await databaseUrl('runtime-database-url');
  try {
    const created = await createOperationsAdmin(input);
    console.info(JSON.stringify({ event: 'operations_admin.created', userId: created.id, role: created.role }));
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Failed to create operations admin.');
  process.exitCode = 1;
});
