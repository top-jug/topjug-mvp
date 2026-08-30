import assert from 'node:assert/strict';
import { link, mkdtemp, mkdir, readFile, rm, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertEmailDeliveryConfigured, deliverEmailChallengeToFile } from '../../src/server/auth/email-delivery';
import { ApiError } from '../../src/server/http/api-error';

const message = { to: 'climber@example.com', purpose: 'register' as const, code: '123456' };

test('local email sink repairs permissive modes and appends with private permissions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'topjug-mail-'));
  const directory = join(root, 'sink');
  const sinkPath = join(directory, 'mail.jsonl');
  try {
    await mkdir(directory, { mode: 0o777 });
    await writeFile(sinkPath, '', { mode: 0o666 });
    await deliverEmailChallengeToFile(message, sinkPath);

    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal((await stat(sinkPath)).mode & 0o777, 0o600);
    const entry = JSON.parse((await readFile(sinkPath, 'utf8')).trim()) as Record<string, string>;
    assert.deepEqual({ to: entry.to, purpose: entry.purpose, code: entry.code }, message);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('local email sink refuses symlinked directories and files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'topjug-mail-'));
  const realDirectory = join(root, 'real');
  const linkedDirectory = join(root, 'linked');
  const targetFile = join(root, 'target');
  try {
    await mkdir(realDirectory);
    await symlink(realDirectory, linkedDirectory, 'dir');
    await assert.rejects(() => deliverEmailChallengeToFile(message, join(linkedDirectory, 'mail.jsonl')));

    await writeFile(targetFile, 'untouched');
    const linkedFile = join(realDirectory, 'mail.jsonl');
    await symlink(targetFile, linkedFile, 'file');
    await assert.rejects(() => deliverEmailChallengeToFile(message, linkedFile));
    assert.equal(await readFile(targetFile, 'utf8'), 'untouched');

    await unlink(linkedFile);
    await link(targetFile, linkedFile);
    await assert.rejects(() => deliverEmailChallengeToFile(message, linkedFile));
    assert.equal(await readFile(targetFile, 'utf8'), 'untouched');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('production readiness accepts only configured SES delivery', () => {
  const previous = {
    profile: process.env.APP_PROFILE,
    mode: process.env.EMAIL_DELIVERY_MODE,
    from: process.env.EMAIL_FROM_ADDRESS,
  };
  try {
    process.env.APP_PROFILE = 'production';
    process.env.EMAIL_DELIVERY_MODE = 'file';
    process.env.EMAIL_FROM_ADDRESS = 'no-reply@topjug.kr';
    assert.throws(assertEmailDeliveryConfigured, (error: unknown) => error instanceof ApiError && error.status === 503);

    process.env.EMAIL_DELIVERY_MODE = 'ses';
    delete process.env.EMAIL_FROM_ADDRESS;
    assert.throws(assertEmailDeliveryConfigured, (error: unknown) => error instanceof ApiError && error.status === 503);
    process.env.EMAIL_FROM_ADDRESS = 'no-reply@topjug.kr';
    assert.doesNotThrow(assertEmailDeliveryConfigured);
  } finally {
    if (previous.profile === undefined) delete process.env.APP_PROFILE;
    else process.env.APP_PROFILE = previous.profile;
    if (previous.mode === undefined) delete process.env.EMAIL_DELIVERY_MODE;
    else process.env.EMAIL_DELIVERY_MODE = previous.mode;
    if (previous.from === undefined) delete process.env.EMAIL_FROM_ADDRESS;
    else process.env.EMAIL_FROM_ADDRESS = previous.from;
  }
});
