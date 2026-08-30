import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { intendedPath } from '../../src/features/auth/auth-navigation';
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
  assert.equal(intendedPath({ from: '/records/record-1/share?preview=true' }), '/records/record-1/share?preview=true');
  assert.equal(intendedPath({ from: 'https://example.com' }), '/');
  assert.equal(intendedPath({ from: '//example.com' }), '/');
  assert.equal(intendedPath(null), '/');
});

test('root onboarding exposes only public exploration routes and keeps home outside RequireAuth', () => {
  const router = projectSource('src/app/router.tsx');
  const onboarding = projectSource('src/features/onboarding/RootScreen.tsx');

  assert.match(router, /<Route path="\/" element={<RootScreen \/>} \/>/);
  assert.match(router, /<Route path="\/gyms" element={<GymSearchPage \/>} \/>/);
  assert.match(router, /<Route path="\/schedule\/:calendarView" element={<CalendarPage \/>} \/>/);
  assert.doesNotMatch(router, /<Route element={<RequireAuth \/>}>\s*<Route path="\/"/);
  assert.match(onboarding, /to="\/login"/);
  assert.match(onboarding, /to="\/register"/);
  assert.match(onboarding, /to="\/gyms"/);
  assert.match(onboarding, /to="\/schedule\/settings"/);
});

test('protected data providers request resources only after authentication', () => {
  const providers = [
    ['src/app/providers/SavedGymsProvider.tsx', 'refreshSavedGyms'],
    ['src/app/providers/MembershipProvider.tsx', 'refreshMemberships'],
    ['src/app/providers/RecordHistoryProvider.tsx', 'fetchRecords'],
  ] as const;

  for (const [path, request] of providers) {
    const source = projectSource(path);
    assert.match(source, new RegExp(`if \\(authStatus === 'authenticated'\\) \\{[\\s\\S]{0,120}\\b${request}\\(`), path);
  }
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
