import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';
type ShellUi = typeof import('@mfe/shell-ui');

let html: string;
let shell: ShellUi;
let RemoteHomePage: typeof import('../pages/index.tsx').default;
let getServerSideProps: typeof import('../pages/index.tsx').getServerSideProps;
let getServerData: typeof import('../lib/getServerData.ts').getServerData;
let parseDashboardQuery: typeof import('../lib/dashboardQuery.ts').parseDashboardQuery;
let renderPage: (session?: typeof shell.DEFAULT_SESSION) => Promise<string>;

test.before(async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  shell = await import('@mfe/shell-ui');
  const pageModule = await import('../pages/index.tsx');
  RemoteHomePage = pageModule.default;
  getServerSideProps = pageModule.getServerSideProps;
  getServerData = (await import('../lib/getServerData.ts')).getServerData;
  parseDashboardQuery = (await import('../lib/dashboardQuery.ts')).parseDashboardQuery;

  renderPage = async (session = shell.DEFAULT_SESSION) =>
    renderToStaticMarkup(
      createElement(RemoteHomePage, {
        serverData: await getServerData(session),
        dashboard: parseDashboardQuery({}),
        initialSession: session,
      })
    );

  html = await renderPage();
});

test('the zone page renders inside the shared shell chrome', () => {
  assert.match(html, /^<div class="layout-root"><header class="app-header">/);
  assert.match(html, /<aside class="layout-sidebar"><nav class="side-navigation"/);
  assert.match(html, /<aside aria-live="polite" class="toast-portal"><\/aside><\/div>$/);
});

test('the zone page links back to the shell and marks itself as the active zone', () => {
  assert.match(html, /<a href="\/" class="nav-link\s*"/);
  assert.match(html, /<a href="\/remote-app" class="nav-link nav-link-active"/);
});

test('the zone content sits in the shell main area with its session banner and server card', () => {
  const main = html.match(/<main class="layout-main">([\s\S]*)<\/main>/)?.[1] ?? '';

  assert.match(main, /<div class="session-banner" data-testid="remote-active-session">/);
  assert.match(main, /<div class="federated-card">/);
});

test('getServerSideProps resolves user session from request cookie header', async () => {
  // Arrange
  const viewer = shell.PRESET_USERS[2]!;
  const fakeContext = {
    req: {
      headers: {
        cookie: `host_user_session=${viewer.userId}`,
      },
    },
    query: {},
    resolvedUrl: '/remote-app',
  } as unknown as Parameters<typeof getServerSideProps>[0];

  // Act
  const result = (await getServerSideProps(fakeContext)) as {
    props: {
      initialSession: typeof shell.DEFAULT_SESSION;
      serverData: { session: typeof shell.DEFAULT_SESSION | null };
    };
  };

  // Assert
  assert.equal(result.props.initialSession.userId, viewer.userId);
  assert.equal(result.props.initialSession.userName, viewer.userName);
  assert.equal(result.props.serverData.session?.userId, viewer.userId);
});

test('getServerSideProps falls back to DEFAULT_SESSION when cookie header is missing', async () => {
  // Arrange
  const fakeContext = {
    req: {
      headers: {},
    },
    query: {},
    resolvedUrl: '/remote-app',
  } as unknown as Parameters<typeof getServerSideProps>[0];

  // Act
  const result = (await getServerSideProps(fakeContext)) as {
    props: {
      initialSession: typeof shell.DEFAULT_SESSION;
      serverData: { session: typeof shell.DEFAULT_SESSION | null };
    };
  };

  // Assert
  assert.equal(result.props.initialSession.userId, shell.DEFAULT_SESSION.userId);
  assert.equal(result.props.serverData.session?.userId, shell.DEFAULT_SESSION.userId);
});

test('the zone page renders with the initialSession without flashing default session', async () => {
  // Arrange
  const viewer = shell.PRESET_USERS[2]!;

  // Act
  const renderedHtml = await renderPage(viewer);

  // Assert
  assert.match(renderedHtml, new RegExp(`<option value="${viewer.userId}" selected="">`));
  assert.match(renderedHtml, /Mariana Lima \(Viewer\)/);
});
