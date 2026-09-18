import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';
import { setupDomEnvironment } from './support/dom-environment.ts';
import type { UserSession } from '@mfe/shell-ui';

type RemoteHomeModule = typeof import('../pages/index.tsx');
type ServerDataModule = typeof import('../lib/getServerData.ts');
type DashboardModule = typeof import('../lib/dashboardQuery.ts');
type ShellModule = typeof import('@mfe/shell-ui');
type ReactModule = typeof import('react');
type ReactDomClientModule = typeof import('react-dom/client');

let RemoteHomePage: RemoteHomeModule['default'];
let getServerData: ServerDataModule['getServerData'];
let parseDashboardQuery: DashboardModule['parseDashboardQuery'];
let shell: ShellModule;
let React: ReactModule;
let ReactDOMClient: ReactDomClientModule;

test.before(async () => {
  RemoteHomePage = (await import('../pages/index.tsx')).default;
  getServerData = (await import('../lib/getServerData.ts')).getServerData;
  parseDashboardQuery = (await import('../lib/dashboardQuery.ts')).parseDashboardQuery;
  shell = await import('@mfe/shell-ui');
  React = await import('react');
  ReactDOMClient = await import('react-dom/client');
});

test('Cenário 1: Validar fluxo de leitura/gravação da sessão no localStorage simulando reinicialização de aba', async () => {
  const operatorUser = shell.PRESET_USERS[1]!; // Carlos Silva (Operator)
  const viewerUser = shell.PRESET_USERS[2]!; // Mariana Lima (Viewer)

  let persistedSessionJson = '';

  // --------------------------------------------------------------------------
  // TAB 1: User boots with default admin session, then switches to Operator
  // --------------------------------------------------------------------------
  {
    const domTab1 = setupDomEnvironment();
    const container1 = domTab1.document.createElement('div');
    domTab1.document.body.appendChild(container1);
    const root1 = ReactDOMClient.createRoot(container1);

    try {
      const initialServerData = await getServerData();
      await React.act(async () => {
        root1.render(
          React.createElement(RemoteHomePage, {
            serverData: initialServerData,
            dashboard: parseDashboardQuery({}),
            initialSession: shell.DEFAULT_SESSION,
          })
        );
      });

      // Verify Tab 1 initial mount reflects default session
      const banner1 = container1.querySelector('[data-testid="remote-active-session"]');
      assert.ok(banner1, 'session banner should be rendered');
      assert.match(banner1.textContent || '', /Ana Souza \(Admin\)/);

      // Tab 1: User selects Operator in Header dropdown
      const select1 = container1.querySelector('select#user-select') as HTMLSelectElement;
      assert.ok(select1, 'user select exists in header');

      await React.act(async () => {
        select1.value = operatorUser.userId;
        select1.dispatchEvent(new domTab1.window.Event('change', { bubbles: true }) as unknown as Event);
      });

      // Assert Tab 1 immediately reflects operator in DOM and localStorage
      assert.match(banner1.textContent || '', /Carlos Silva \(Operator\)/);
      assert.ok(banner1.querySelector('.role-operator'), 'should have .role-operator class tag');

      persistedSessionJson = domTab1.window.localStorage.getItem(shell.SESSION_STORAGE_KEY) || '';
      assert.ok(persistedSessionJson, 'session must be saved to localStorage');
      const parsedSaved = JSON.parse(persistedSessionJson) as UserSession;
      assert.equal(parsedSaved.userId, operatorUser.userId);
      assert.equal(parsedSaved.userName, operatorUser.userName);
      assert.match(domTab1.document.cookie, new RegExp(`host_user_session=${operatorUser.userId}`));
    } finally {
      await React.act(async () => {
        root1.unmount();
      });
      domTab1.cleanup();
    }
  }

  // --------------------------------------------------------------------------
  // TAB 2: New browser tab boots; effect restores Operator from localStorage
  // --------------------------------------------------------------------------
  {
    const domTab2 = setupDomEnvironment();
    // Simulate browser persistent storage preserving the item across tabs
    domTab2.window.localStorage.setItem(shell.SESSION_STORAGE_KEY, persistedSessionJson);

    const container2 = domTab2.document.createElement('div');
    domTab2.document.body.appendChild(container2);
    const root2 = ReactDOMClient.createRoot(container2);

    try {
      const serverData = await getServerData();

      // Mount Tab 2 without hardcoded initialSession (simulating fresh page boot)
      await React.act(async () => {
        root2.render(
          React.createElement(RemoteHomePage, {
            serverData,
            dashboard: parseDashboardQuery({}),
          })
        );
      });

      // Assert that after mount effect runs, the mirrored session from localStorage is active
      const banner2 = container2.querySelector('[data-testid="remote-active-session"]');
      assert.ok(banner2);
      assert.match(
        banner2.textContent || '',
        /Carlos Silva \(Operator\)/,
        'Tab 2 restored operator session from localStorage'
      );

      const select2 = container2.querySelector('select#user-select') as HTMLSelectElement;
      assert.equal(select2.value, operatorUser.userId, 'Header dropdown synced to restored session');

      // Tab 2: User switches session to Viewer
      await React.act(async () => {
        select2.value = viewerUser.userId;
        select2.dispatchEvent(new domTab2.window.Event('change', { bubbles: true }) as unknown as Event);
      });

      // Assert Tab 2 DOM and shared storage updated to Viewer
      assert.match(banner2.textContent || '', /Mariana Lima \(Viewer\)/);
      persistedSessionJson = domTab2.window.localStorage.getItem(shell.SESSION_STORAGE_KEY) || '';
      assert.ok(persistedSessionJson);
      const parsedViewer = JSON.parse(persistedSessionJson) as UserSession;
      assert.equal(parsedViewer.userId, viewerUser.userId);
    } finally {
      await React.act(async () => {
        root2.unmount();
      });
      domTab2.cleanup();
    }
  }

  // --------------------------------------------------------------------------
  // TAB 3: Subsequent tab confirms Viewer session persisted
  // --------------------------------------------------------------------------
  {
    const domTab3 = setupDomEnvironment();
    domTab3.window.localStorage.setItem(shell.SESSION_STORAGE_KEY, persistedSessionJson);

    const container3 = domTab3.document.createElement('div');
    domTab3.document.body.appendChild(container3);
    const root3 = ReactDOMClient.createRoot(container3);

    try {
      const serverData = await getServerData();
      await React.act(async () => {
        root3.render(
          React.createElement(RemoteHomePage, {
            serverData,
            dashboard: parseDashboardQuery({}),
          })
        );
      });

      const banner3 = container3.querySelector('[data-testid="remote-active-session"]');
      assert.ok(banner3);
      assert.match(
        banner3.textContent || '',
        /Mariana Lima \(Viewer\)/,
        'Tab 3 restored viewer session from previous tab change'
      );
    } finally {
      await React.act(async () => {
        root3.unmount();
      });
      domTab3.cleanup();
    }
  }
});

test('tolera falha de localStorage (modo privado/restrito) mantendo navegação e estado em memória', async () => {
  const dom = setupDomEnvironment();

  // Simulate private browsing / blocked storage throwing SecurityError on access
  Object.defineProperty(dom.window, 'localStorage', {
    get() {
      throw new Error('SecurityError: The operation is insecure.');
    },
    configurable: true,
  });

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);

  try {
    const serverData = await getServerData();

    await React.act(async () => {
      root.render(
        React.createElement(RemoteHomePage, {
          serverData,
          dashboard: parseDashboardQuery({}),
          initialSession: shell.DEFAULT_SESSION,
        })
      );
    });

    const banner = container.querySelector('[data-testid="remote-active-session"]');
    assert.ok(banner);
    assert.match(banner.textContent || '', /Ana Souza \(Admin\)/);

    // Changing session in memory still works without uncaught exception
    const select = container.querySelector('select#user-select') as HTMLSelectElement;
    await React.act(async () => {
      select.value = shell.PRESET_USERS[2]!.userId;
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }) as unknown as Event);
    });

    assert.match(banner.textContent || '', /Mariana Lima \(Viewer\)/);
  } finally {
    await React.act(async () => {
      root.unmount();
    });
    dom.cleanup();
  }
});
