import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

type RenderResult = {
  routes: {
    root: { text: string; location: { pathname: string } };
    protectedRoute: { pathname: string; search: string; hash: string; state: { from: string } };
    calendarRoute: { pathname: string; search: string; hash: string; state: { from: string } };
    auth: {
      inputType: string;
      inputAriaLabel: string | null;
      labelText: string;
      interactiveLabelDescendants: number;
      toggleName: string;
      toggleText: string;
    };
  };
  providers: { unauthenticatedRequests: string[]; authenticatedRequests: string[] };
};

function renderContracts(): RenderResult {
  const script = fileURLToPath(new URL('./render-auth-contracts.tsx', import.meta.url));
  const child = spawnSync(process.execPath, ['--import', 'tsx', script], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const output = child.stdout.split('\n').find((line) => line.startsWith('RENDER_RESULT='));
  assert.ok(output, child.stdout);
  return JSON.parse(output.slice('RENDER_RESULT='.length)) as RenderResult;
}

const rendered = renderContracts();

test('rendered AppRouter keeps unauthenticated root on onboarding', () => {
  assert.equal(rendered.routes.root.location.pathname, '/');
  assert.match(rendered.routes.root.text, /오를수록 쌓이는/);
  assert.doesNotMatch(rendered.routes.root.text, /다시 만나서 반가워요/);
});

test('rendered protected route guards retain search and hash redirect state', () => {
  assert.deepEqual(rendered.routes.protectedRoute, {
    pathname: '/login',
    search: '',
    hash: '',
    state: { from: '/records/record-1/share?preview=true#difficulty-3' },
  });
  assert.deepEqual(rendered.routes.calendarRoute, {
    pathname: '/login',
    search: '',
    hash: '',
    state: { from: '/schedule/records?month=2026-08#day-20' },
  });
});

test('rendered AuthScreen separates the password label and toggle', () => {
  assert.deepEqual(rendered.routes.auth, {
    inputType: 'password',
    inputAriaLabel: null,
    labelText: '비밀번호',
    interactiveLabelDescendants: 0,
    toggleName: '비밀번호 보기',
    toggleText: '보기',
  });
});

test('rendered app provider wiring gates protected resource requests by auth state', () => {
  assert.deepEqual(rendered.providers.unauthenticatedRequests, []);
  assert.ok(rendered.providers.authenticatedRequests.some((url) => url.includes('/api/v1/me/saved-gyms')));
  assert.ok(rendered.providers.authenticatedRequests.some((url) => url.includes('/api/v1/memberships')));
  assert.ok(rendered.providers.authenticatedRequests.some((url) => url.includes('/api/v1/records')));
});
