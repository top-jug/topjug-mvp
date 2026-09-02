import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import config from '../../capacitor.config';

const TOPJUG_ORIGIN = 'https://topjug.kr/';

test('mobile wrappers only load the HTTPS TopJug origin', () => {
  assert.equal(config.server?.url, TOPJUG_ORIGIN);
  assert.equal(config.server?.cleartext, false);
  assert.deepEqual(config.server?.allowNavigation, undefined);
  assert.equal(config.ios?.appendUserAgent, 'TopJug-iOS/0.1.0');
});

test('iOS wrapper keeps a local error page without inline executable code', async () => {
  assert.equal(config.webDir, 'native/ios-shell');
  assert.equal(config.server?.errorPath, 'error.html');

  const [errorPage, shellScript] = await Promise.all([
    readFile(new URL('../../native/ios-shell/error.html', import.meta.url), 'utf8'),
    readFile(new URL('../../native/ios-shell/shell.js', import.meta.url), 'utf8'),
  ]);

  assert.match(errorPage, /Content-Security-Policy/);
  assert.doesNotMatch(errorPage, /<script[^>]*>[^<]+<\/script>/);
  assert.match(shellScript, /https:\/\/topjug\.kr\//);
});

test('release builds do not enable production Capacitor logging', () => {
  assert.equal(config.loggingBehavior, 'debug');
});
