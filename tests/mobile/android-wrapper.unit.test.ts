import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import config from '../../capacitor.config';

test('Android wrapper uses the shared HTTPS TopJug origin', async () => {
  assert.equal(config.server?.url, 'https://topjug.kr/');
  assert.equal(config.server?.cleartext, false);
  assert.deepEqual(config.server?.allowNavigation, undefined);

  const manifest = await readFile(new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(manifest, /android:exported="true"/);
});

test('Android project keeps the expected application identity and SDK floor', async () => {
  const variables = await readFile(new URL('../../android/variables.gradle', import.meta.url), 'utf8');
  const appGradle = await readFile(new URL('../../android/app/build.gradle', import.meta.url), 'utf8');
  assert.match(variables, /minSdkVersion\s*=\s*24/);
  assert.match(appGradle, /namespace\s*=\s*"kr\.topjug\.app"/);
});
