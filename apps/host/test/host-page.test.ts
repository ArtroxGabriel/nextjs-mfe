import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';

/**
 * The shell's own page wears the same shared chrome as the zone, and
 * HostLayout is the only place the host wires its callbacks into it.
 *
 * HostLayout has no hooks, so it is called as a function and the element it
 * returns is inspected; the page itself has hooks and is only rendered.
 * The page's session effect and the handler it passes down run only in the
 * browser (D10 in .agents/orchestrator/DEFERRED.md).
 */

type ShellUi = typeof import('@mfe/shell-ui');

let shell: ShellUi;
let HostLayout: (typeof import('../components/HostLayout.tsx'))['default'];
let renderHostPage: () => string;

test.before(async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  shell = await import('@mfe/shell-ui');
  HostLayout = (await import('../components/HostLayout.tsx')).default;
  const { default: HostHomePage } = await import('../pages/index.tsx');

  renderHostPage = () =>
    renderToStaticMarkup(
      createElement(HostHomePage, {
        hostRenderTimestamp: '2026-09-15T00:00:00.000Z',
        initialSession: shell.DEFAULT_SESSION,
        initialRoute: '/',
      })
    );
});

interface ElementLike {
  readonly type: unknown;
  readonly props: Record<string, unknown>;
}

function callHostLayout(props: Record<string, unknown>): ElementLike {
  return (HostLayout as unknown as (p: Record<string, unknown>) => ElementLike)(props);
}

test('the host page renders inside the shared shell chrome with the shell home active', () => {
  const html = renderHostPage();

  assert.match(html, /^<div class="layout-root"><header class="app-header">/);
  assert.match(html, /<aside class="layout-sidebar"><nav class="side-navigation"/);
  assert.match(html, /<a href="\/" class="nav-link nav-link-active"/);
  assert.match(html, /<a href="\/remote-app" class="nav-link\s*"/);
  assert.match(html, /<main class="layout-main"><section class="host-section">/);
});

test('HostLayout hands the session, its route and its children to the shared ShellLayout', () => {
  const session = shell.PRESET_USERS[1]!;
  const onSessionChange = () => {};
  const children = 'page body';

  const element = callHostLayout({ currentSession: session, onSessionChange, activeRoute: '/x', children });

  assert.equal(element.type, shell.ShellLayout);
  assert.equal(element.props.currentSession, session);
  assert.equal(element.props.onSessionChange, onSessionChange);
  assert.equal(element.props.activeRoute, '/x');
  assert.equal(element.props.children, children);
});

test('HostLayout pings through the shared toast event and reports navigation', () => {
  const element = callHostLayout({ currentSession: shell.DEFAULT_SESSION, onSessionChange: () => {}, children: null });
  const onToastPing = element.props.onToastPing as () => void;
  const onNavigate = element.props.onNavigate as (label: string, destination: string) => void;
  assert.equal(typeof onNavigate, 'function');

  const target = new EventTarget();
  const saved = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = target;
  const titles: string[] = [];
  try {
    target.addEventListener(shell.MFE_EVENTS.TOAST, (event) => titles.push((event as CustomEvent).detail.title));
    onToastPing();
    onNavigate('Remote App Zone', '/remote-app');
  } finally {
    (globalThis as { window?: unknown }).window = saved;
  }

  assert.deepEqual(titles, ['Host Notification']);
});
