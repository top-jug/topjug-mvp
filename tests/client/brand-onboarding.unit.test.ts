import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { intendedPath, loginRedirectState, protectedDestination, shouldLoadProtectedResources } from '../../src/features/auth/auth-navigation';
import { passwordVisibilityControl } from '../../src/features/auth/auth-presentation';
import { ONBOARDING_ROUTES } from '../../src/features/onboarding/onboarding-routes';
import { getRootRouteView } from '../../src/features/onboarding/root-route';

const projectFile = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url));
const projectSource = (path: string) => projectFile(path).toString('utf8');

test('root route selects an explicit view for every auth state', () => {
  assert.equal(getRootRouteView('loading'), 'loading');
  assert.equal(getRootRouteView('error'), 'error');
  assert.equal(getRootRouteView('unauthenticated'), 'onboarding');
  assert.equal(getRootRouteView('authenticated'), 'home');
});

test('protected deep links survive auth while unsafe destinations fall back home', () => {
  const location = { pathname: '/records/record-1/share', search: '?preview=true', hash: '#difficulty-3' };
  const destination = '/records/record-1/share?preview=true#difficulty-3';

  assert.equal(protectedDestination(location), destination);
  assert.deepEqual(loginRedirectState(location), { from: destination });
  assert.equal(intendedPath(loginRedirectState(location)), destination);
  assert.equal(intendedPath({ from: 'https://example.com' }), '/');
  assert.equal(intendedPath({ from: '//example.com' }), '/');
  assert.equal(intendedPath(null), '/');
});

test('onboarding destinations expose auth and public exploration entry points', () => {
  assert.deepEqual(ONBOARDING_ROUTES, {
    login: '/login',
    register: '/register',
    gyms: '/gyms',
    calendar: '/schedule/settings',
  });
});

test('protected resources load for authenticated state only', () => {
  assert.equal(shouldLoadProtectedResources('loading'), false);
  assert.equal(shouldLoadProtectedResources('error'), false);
  assert.equal(shouldLoadProtectedResources('unauthenticated'), false);
  assert.equal(shouldLoadProtectedResources('authenticated'), true);
});

test('password visibility control keeps the visible label in its accessible name', () => {
  assert.deepEqual(passwordVisibilityControl(false), {
    inputType: 'password',
    visibleLabel: '보기',
    accessibleName: '비밀번호 보기',
  });
  assert.deepEqual(passwordVisibilityControl(true), {
    inputType: 'text',
    visibleLabel: '숨기기',
    accessibleName: '비밀번호 숨기기',
  });
});

test('manifest declares valid normal and maskable PNG assets at their real dimensions', () => {
  const manifest = JSON.parse(projectSource('public/manifest.webmanifest')) as {
    icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
  };

  assert.deepEqual(manifest.icons.map(({ sizes, type, purpose }) => ({ sizes, type, purpose })), [
    { sizes: '192x192', type: 'image/png', purpose: 'any' },
    { sizes: '512x512', type: 'image/png', purpose: 'any' },
    { sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]);

  for (const icon of manifest.icons) {
    const png = projectFile(`public${icon.src}`);
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

test('auth and share brand surfaces use the canonical icon component', () => {
  assert.match(projectSource('src/features/auth/AuthScreen.tsx'), /BrandLockup/);
  assert.match(projectSource('src/app/pages/PublicRecordSharePage.tsx'), /<BrandIcon decorative/);
  assert.match(projectSource('src/app/pages/RecordSharePage.tsx'), /<BrandIcon decorative/);
  assert.match(projectSource('src/features/record/record-share-image.ts'), /\/icons\/icon-192\.png/);
  assert.ok(projectFile('public/brand/topjug-icon-source.jpg').byteLength > 0);
});
