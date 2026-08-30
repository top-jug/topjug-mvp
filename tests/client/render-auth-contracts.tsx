import { act, create, type ReactTestInstance, type ReactTestRenderer, type ReactTestRendererJSON } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router';
import { AppDataProviders } from '../../src/app/App';
import { AppRouter } from '../../src/app/router';
import { AuthContext, type AuthContextValue } from '../../src/features/auth/AuthProvider';
import type { AuthStatus, AuthUser } from '../../src/features/auth/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.assign(globalThis, { window: globalThis });

const user: AuthUser = {
  id: 'user-1',
  email: 'climber@example.com',
  displayName: 'Climber',
  homeRegionCode: null,
  emailVerifiedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  homeRegion: null,
  stats: { savedGyms: 0, memberships: 0, recordsThisMonth: 0 },
};

function authValue(status: AuthStatus): AuthContextValue {
  const authenticated = status === 'authenticated';
  const noop = async () => {};
  return {
    status,
    user: authenticated ? user : null,
    error: null,
    isRestoringSession: status === 'loading',
    isRefreshingUser: false,
    refreshUserError: null,
    login: noop,
    register: noop,
    logout: noop,
    refreshUser: noop,
    retry: noop,
  };
}

function textContent(node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null): string {
  if (node === null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  return (node.children ?? []).map((child) => textContent(child as ReactTestRendererJSON | string)).join(' ');
}

function instanceText(node: ReactTestInstance): string {
  return node.children.map((child) => typeof child === 'string' ? child : instanceText(child)).join(' ');
}

const currentLocation: { current?: { pathname: string; search: string; hash: string; state: unknown } } = {};

function LocationProbe() {
  const location = useLocation();
  currentLocation.current = {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    state: location.state,
  };
  return null;
}

async function renderRoute(path: string, status: AuthStatus) {
  currentLocation.current = undefined;
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <AuthContext.Provider value={authValue(status)}>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <AppRouter />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await Promise.resolve();
  });
  const observedLocation = currentLocation.current as {
    pathname: string;
    search: string;
    hash: string;
    state: unknown;
  } | undefined;
  const result = {
    text: textContent(renderer!.toJSON()),
    location: observedLocation && {
      pathname: observedLocation.pathname,
      search: observedLocation.search,
      hash: observedLocation.hash,
      state: observedLocation.state,
    },
    renderer: renderer!,
  };
  return result;
}

async function renderedRoutes() {
  const root = await renderRoute('/', 'unauthenticated');
  const protectedRoute = await renderRoute('/records/record-1/share?preview=true#difficulty-3', 'unauthenticated');
  const calendarRoute = await renderRoute('/schedule/records?month=2026-08#day-20', 'unauthenticated');
  const login = await renderRoute('/login', 'unauthenticated');
  const passwordInput = login.renderer.root.findByProps({ id: 'auth-password' });
  const passwordLabel = login.renderer.root.findByProps({ htmlFor: 'auth-password' });
  const passwordToggle = login.renderer.root.findByProps({ 'aria-label': '비밀번호 보기' });

  const result = {
    root: { text: root.text, location: root.location },
    protectedRoute: protectedRoute.location,
    calendarRoute: calendarRoute.location,
    auth: {
      inputType: passwordInput.props.type,
      inputAriaLabel: passwordInput.props['aria-label'] ?? null,
      labelText: instanceText(passwordLabel),
      interactiveLabelDescendants: passwordLabel.findAllByType('button').length,
      toggleName: passwordToggle.props['aria-label'],
      toggleText: instanceText(passwordToggle),
    },
  };

  root.renderer.unmount();
  protectedRoute.renderer.unmount();
  calendarRoute.renderer.unmount();
  login.renderer.unmount();
  return result;
}

async function renderedProviderWiring() {
  const requests: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    const payload = url.includes('/auth/refresh')
      ? { data: { accessToken: 'test-access-token', accessTokenExpiresIn: 300 } }
      : url.includes('/records')
        ? { data: [], meta: { nextCursor: null } }
        : { data: [] };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <AuthContext.Provider value={authValue('unauthenticated')}>
        <AppDataProviders><span>provider child</span></AppDataProviders>
      </AuthContext.Provider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  const unauthenticatedRequests = [...requests];

  await act(async () => {
    renderer!.update(
      <AuthContext.Provider value={authValue('authenticated')}>
        <AppDataProviders><span>provider child</span></AppDataProviders>
      </AuthContext.Provider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  const authenticatedRequests = requests.slice(unauthenticatedRequests.length);
  renderer!.unmount();
  globalThis.fetch = originalFetch;
  return { unauthenticatedRequests, authenticatedRequests };
}

async function main() {
  const result = {
    routes: await renderedRoutes(),
    providers: await renderedProviderWiring(),
  };
  console.log(`RENDER_RESULT=${JSON.stringify(result)}`);
}

void main();
