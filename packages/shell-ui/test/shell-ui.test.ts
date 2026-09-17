import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { ReactElement, ReactNode } from 'react';
import './support/register-tsx.ts';

/**
 * The shell chrome is rendered for real: markup through react-dom/server, and
 * event handlers by calling the hook-free components (Header, SideNavigation,
 * ShellLayout) as functions and invoking the handlers they return.
 *
 * Not covered without a DOM renderer, which the workspace does not have:
 * ToastContainer's effect that subscribes to the toast event, and anything a
 * page does inside an effect. See D10 in .agents/orchestrator/DEFERRED.md.
 */

type ShellUi = typeof import('../src/index.ts');
type Types = typeof import('../src/types.ts');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = path.join(__dirname, '..');
const ROOT_DIR = path.join(PACKAGE_DIR, '..', '..');

let shell: ShellUi;
let types: Types;
let createElement: typeof import('react').createElement;
let render: (element: ReactElement) => string;

test.before(async () => {
  const react = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  createElement = react.createElement;
  render = renderToStaticMarkup;
  shell = await import('../src/index.ts');
  types = await import('../src/types.ts');
});

interface AnyElement {
  readonly type: unknown;
  readonly props: Record<string, unknown> & { children?: ReactNode };
}

function isElement(node: unknown): node is AnyElement {
  return typeof node === 'object' && node !== null && 'type' in node && 'props' in node;
}

/** Every element in a tree returned by calling a component, without rendering nested components. */
function collect(node: unknown, out: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
  } else if (isElement(node)) {
    out.push(node);
    collect(node.props.children, out);
  }
  return out;
}

function hostElements(tree: unknown, tag: string): AnyElement[] {
  return collect(tree).filter((element) => element.type === tag);
}

function withWindow<T>(run: (target: EventTarget) => T): T {
  const target = new EventTarget();
  const saved = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = target;
  try {
    return run(target);
  } finally {
    (globalThis as { window?: unknown }).window = saved;
  }
}

test('PRESET_USERS contains 3 valid enterprise users with roles and tenants', () => {
  assert.equal(types.PRESET_USERS.length, 3);
  for (const user of types.PRESET_USERS) {
    assert.ok(user.userId.startsWith('usr_'));
    assert.ok(user.userName.length > 0);
    assert.ok(['admin', 'operator', 'viewer'].includes(user.role));
    assert.ok(user.tenant.length > 0);
    assert.ok(user.email.includes('@'));
  }
});

test('DEFAULT_SESSION is the first preset user', () => {
  assert.deepEqual(types.DEFAULT_SESSION, types.PRESET_USERS[0]);
});

test('the header renders the brand, the session selector on the current user, and the ping button', () => {
  const viewer = types.PRESET_USERS[2]!;
  const html = render(createElement(shell.Header, { currentSession: viewer }));

  assert.match(html, /<header class="app-header">/);
  assert.match(html, /<select id="user-select"[^>]*class="session-dropdown"/);
  assert.equal((html.match(/<option /g) ?? []).length, types.PRESET_USERS.length);
  assert.match(html, new RegExp(`<option value="${viewer.userId}" selected="">`));
  assert.match(html, /<button type="button" class="header-toast-btn">/);
});

test('the ping button is rendered even when the zone passes no onToastPing', () => {
  const tree = shell.Header({});

  const buttons = hostElements(tree, 'button');
  assert.equal(buttons.length, 1);
  assert.equal(typeof buttons[0]!.props.onClick, 'function');
});

test('the ping button hides only when showToastButton is false', () => {
  assert.equal(hostElements(shell.Header({ showToastButton: false }), 'button').length, 0);
});

test('pinging without onToastPing dispatches the shared toast event on window', () => {
  const received = withWindow((target) => {
    const events: CustomEvent[] = [];
    target.addEventListener(shell.MFE_EVENTS.TOAST, (event) => events.push(event as CustomEvent));
    const [button] = hostElements(shell.Header({ brandTitle: 'Zone' }), 'button');
    (button!.props.onClick as () => void)();
    return events;
  });

  assert.equal(received.length, 1);
  assert.equal(received[0]!.detail.title, 'Shell Notification');
  assert.match(received[0]!.detail.message, /Zone/);
});

test('pinging with onToastPing calls it instead of dispatching', () => {
  let pinged = 0;
  const received = withWindow((target) => {
    let count = 0;
    target.addEventListener(shell.MFE_EVENTS.TOAST, () => count++);
    const [button] = hostElements(shell.Header({ onToastPing: () => pinged++ }), 'button');
    (button!.props.onClick as () => void)();
    return count;
  });

  assert.equal(pinged, 1);
  assert.equal(received, 0);
});

test('choosing a user in the selector reports that preset to onSessionChange', () => {
  const chosen: unknown[] = [];
  const [select] = hostElements(shell.Header({ onSessionChange: (s) => chosen.push(s) }), 'select');

  (select!.props.onChange as (e: unknown) => void)({ target: { value: types.PRESET_USERS[1]!.userId } });
  (select!.props.onChange as (e: unknown) => void)({ target: { value: 'usr_unknown' } });

  assert.deepEqual(chosen, [types.PRESET_USERS[1]]);
});

test('the side navigation links both zones with plain anchors that do not intercept the click', () => {
  const navigated: string[][] = [];
  const tree = shell.SideNavigation({ onNavigate: (label, destination) => navigated.push([label, destination]) });

  const anchors = hostElements(tree, 'a');
  assert.deepEqual(anchors.map((a) => a.props.href), ['/', '/remote-app']);
  // A component in place of a host <a> (next/link or a wrapper) would not be counted above.
  // Fragments (a symbol type) are harmless and allowed.
  const components = collect(tree).filter((e) => typeof e.type === 'function' || typeof e.type === 'object');
  assert.equal(components.length, 0);

  for (const anchor of anchors) {
    let prevented = false;
    (anchor.props.onClick as (e: unknown) => void)({ preventDefault: () => (prevented = true) });
    assert.equal(prevented, false, `${String(anchor.props.href)} must leave navigation to the browser`);
  }
  assert.deepEqual(navigated, [['Shell Home', '/'], ['Remote App Zone', '/remote-app']]);
});

test('the side navigation marks the link of the active zone', () => {
  const active = (route: string) =>
    render(createElement(shell.SideNavigation, { activeRoute: route })).match(/<a href="([^"]+)" class="nav-link nav-link-active"/g);

  assert.deepEqual(active('/'), ['<a href="/" class="nav-link nav-link-active"']);
  assert.deepEqual(active('/remote-app'), ['<a href="/remote-app" class="nav-link nav-link-active"']);
});

test('the shell layout renders header, sidebar, children, and the toast portal around the page', () => {
  const html = render(
    createElement(shell.ShellLayout, { activeRoute: '/remote-app', children: createElement('p', { id: 'page' }, 'zone body') })
  );

  assert.match(html, /^<div class="layout-root"><header class="app-header">/);
  assert.match(html, /<aside class="layout-sidebar"><nav class="side-navigation"/);
  assert.match(html, /<main class="layout-main"><p id="page">zone body<\/p><\/main>/);
  assert.match(html, /<a href="\/remote-app" class="nav-link nav-link-active"/);
  assert.match(html, /<aside aria-live="polite" class="toast-portal"><\/aside><\/div>$/);
});

test('the shell layout hands the session and navigation callbacks to the header and the navigation', () => {
  const onSessionChange = () => {};
  const onNavigate = () => {};
  const onToastPing = () => {};
  const session = types.PRESET_USERS[1]!;

  const elements = collect(shell.ShellLayout({ children: null, currentSession: session, onSessionChange, onNavigate, onToastPing }));
  const header = elements.find((e) => e.type === shell.Header);
  const nav = elements.find((e) => e.type === shell.SideNavigation);

  assert.ok(header && nav);
  assert.equal(header.props.currentSession, session);
  assert.equal(header.props.onSessionChange, onSessionChange);
  assert.equal(header.props.onToastPing, onToastPing);
  assert.equal(nav.props.onNavigate, onNavigate);
});

test('the package imports nothing but react and its own modules', () => {
  const sourceDir = path.join(PACKAGE_DIR, 'src');
  for (const file of fs.readdirSync(sourceDir).filter((f) => /\.tsx?$/.test(f))) {
    const { importedFiles } = ts.preProcessFile(fs.readFileSync(path.join(sourceDir, file), 'utf-8'), true, true);
    for (const { fileName } of importedFiles) {
      if (fileName === 'react') continue;
      const resolved = path.resolve(sourceDir, fileName);
      assert.ok(
        fileName.startsWith('.') && path.dirname(resolved) === sourceDir,
        `${file} imports ${fileName}, outside packages/shell-ui/src`
      );
    }
  }
});

test('shell-layout.css defines the selectors the components render', () => {
  const css = fs.readFileSync(path.join(PACKAGE_DIR, 'src', 'shell-layout.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
  const html = render(createElement(shell.ShellLayout, { children: null }));
  const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1]!.split(/\s+/).filter(Boolean)));

  for (const name of classes) {
    assert.match(css, new RegExp(`\\.${name}(?![\\w-])`), `.${name} is rendered but not styled`);
  }
});

test('each app stylesheet imports shell-layout.css, and every @import resolves', () => {
  const sharedCss = fs.realpathSync(path.join(PACKAGE_DIR, 'src', 'shell-layout.css'));

  for (const app of ['host', 'remote-app']) {
    const stylesDir = path.join(ROOT_DIR, 'apps', app, 'styles');
    const css = fs.readFileSync(path.join(stylesDir, 'globals.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
    const targets = [...css.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map((m) => path.resolve(stylesDir, m[1]!));

    assert.ok(targets.length > 0, `apps/${app} globals.css has no @import`);
    for (const target of targets) {
      assert.ok(fs.existsSync(target), `apps/${app} @import does not resolve: ${target}`);
    }
    assert.ok(targets.some((t) => fs.realpathSync(t) === sharedCss), `apps/${app} does not import shell-layout.css`);
  }
});

test('apps do not override or redeclare shell chrome selectors locally', () => {
  // Selectors that belong exclusively to the shared shell frame package
  const forbiddenSelectors = [
    '\\.app-header',
    '\\.layout-root',
    '\\.layout-body',
    '\\.layout-sidebar',
    '\\.side-navigation',
    '\\.nav-link',
    '\\.nav-list',
    '\\.nav-section-title',
    '\\.header-brand',
    '\\.brand-logo',
    '\\.brand-title',
    '\\.header-actions',
    '\\.system-pill',
    '\\.session-selector',
    '\\.toast-portal',
    '\\.toast-card',
  ];

  for (const app of ['host', 'remote-app']) {
    const cssPath = path.join(ROOT_DIR, 'apps', app, 'styles', 'globals.css');
    const cssContent = fs
      .readFileSync(cssPath, 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@import\s+[^;]+;/g, '');

    for (const selector of forbiddenSelectors) {
      const regex = new RegExp(`(^|\\n|[{},;\\s])${selector}[\\s,{]`, 'm');
      assert.ok(
        !regex.test(cssContent),
        `apps/${app}/styles/globals.css locally redefines shared chrome selector ${selector.replace('\\', '')}`
      );
    }
  }
});

test('apps do not define conflicting base background or border tokens', () => {
  for (const app of ['host', 'remote-app']) {
    const cssPath = path.join(ROOT_DIR, 'apps', app, 'styles', 'globals.css');
    const cssContent = fs
      .readFileSync(cssPath, 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@import\s+[^;]+;/g, '');

    // Any :root in app-level globals.css must not conflict with canonical shell tokens
    const rootMatches = cssContent.match(/:root\s*\{([^}]+)\}/g) || [];
    for (const rootBlock of rootMatches) {
      assert.ok(
        !rootBlock.includes('--bg-color: #0f172a'),
        `apps/${app} defines conflicting --bg-color #0f172a, must match shell`
      );
      assert.ok(
        !rootBlock.includes('--border-color: #334155'),
        `apps/${app} defines conflicting --border-color #334155, must match shell`
      );
    }
  }
});

