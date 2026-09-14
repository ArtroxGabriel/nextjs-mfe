import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRESET_USERS,
  DEFAULT_SESSION,
} from '../src/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '..', 'src');

function readSource(fileName: string): string {
  const filePath = path.join(SRC_DIR, fileName);
  assert.ok(fs.existsSync(filePath), `expected file to exist at ${filePath}`);
  return fs.readFileSync(filePath, 'utf-8');
}

test('PRESET_USERS contains 3 valid enterprise users with roles and tenants', () => {
  // Arrange & Assert
  assert.equal(PRESET_USERS.length, 3);
  for (const user of PRESET_USERS) {
    assert.ok(user.userId.startsWith('usr_'));
    assert.ok(user.userName.length > 0);
    assert.ok(['admin', 'operator', 'viewer'].includes(user.role));
    assert.ok(user.tenant.length > 0);
    assert.ok(user.email.includes('@'));
  }
});

test('DEFAULT_SESSION is the first preset user', () => {
  // Assert
  assert.deepEqual(DEFAULT_SESSION, PRESET_USERS[0]);
});

test('Header component adheres to shell-ui design contracts', () => {
  const source = readSource('Header.tsx');

  assert.match(source, /export const Header =/);
  assert.match(source, /className="app-header"/);
  assert.match(source, /className="session-selector"/);
  assert.doesNotMatch(source, /@module-federation/, 'must have zero module federation residue');
});

test('SideNavigation strictly adheres to Multi-Zones plain <a> tag invariant', () => {
  const source = readSource('SideNavigation.tsx');

  assert.match(source, /export const SideNavigation =/);
  assert.match(source, /<a\s+href="\/"/);
  assert.match(source, /<a\s+href="\/remote-app"/);
  assert.doesNotMatch(source, /<Link\s/, 'cross-zone navigation MUST NEVER use Next.js <Link>');
  assert.doesNotMatch(source, /next\/link/, 'must not import next/link');
});

test('ShellLayout wraps Header, SideNavigation, and children main container', () => {
  const source = readSource('ShellLayout.tsx');

  assert.match(source, /export const ShellLayout =/);
  assert.match(source, /<Header/);
  assert.match(source, /<SideNavigation/);
  assert.match(source, /className="layout-root"/);
  assert.match(source, /className="layout-main"/);
});

test('shell-layout.css exists and defines critical shell layout and toast selectors', () => {
  const css = readSource('shell-layout.css');

  assert.ok(css.includes('.layout-root'));
  assert.ok(css.includes('.app-header'));
  assert.ok(css.includes('.side-navigation'));
  assert.ok(css.includes('--header-height'));
  assert.ok(css.includes('--sidebar-width'));
  assert.ok(css.includes('.toast-portal'));
  assert.ok(css.includes('.toast-card'));
  assert.ok(css.includes('.toast-success'));
});

test('ShellLayout embeds ToastContainer to ensure toasts render across all zones', () => {
  const source = readSource('ShellLayout.tsx');

  assert.match(source, /<ToastContainer/);
});

test('Header always renders Ping Toast button with default emitToast fallback', () => {
  const source = readSource('Header.tsx');

  assert.match(source, /className="header-toast-btn"/);
  assert.match(source, /🔔 Ping Toast/);
  assert.match(source, /emitToast/);
});

test('globals.css in apps/host and apps/remote-app resolve shell-layout.css', () => {
  const rootDir = path.resolve(__dirname, '..', '..', '..');
  const hostCss = fs.readFileSync(path.join(rootDir, 'apps', 'host', 'styles', 'globals.css'), 'utf-8');
  const remoteCss = fs.readFileSync(path.join(rootDir, 'apps', 'remote-app', 'styles', 'globals.css'), 'utf-8');

  const hostMatch = hostCss.match(/@import\s+['"]([^'"]+)['"]/);
  assert.ok(hostMatch, 'host globals.css must have @import');
  const hostResolved = path.resolve(rootDir, 'apps', 'host', 'styles', hostMatch[1]);
  assert.ok(fs.existsSync(hostResolved), `host CSS @import path must resolve: ${hostResolved}`);

  const remoteMatch = remoteCss.match(/@import\s+['"]([^'"]+)['"]/);
  assert.ok(remoteMatch, 'remote globals.css must have @import');
  const remoteResolved = path.resolve(rootDir, 'apps', 'remote-app', 'styles', remoteMatch[1]);
  assert.ok(fs.existsSync(remoteResolved), `remote CSS @import path must resolve: ${remoteResolved}`);
});

test('remote-app index page has active session visualization and passes session to ServerCard', () => {
  const rootDir = path.resolve(__dirname, '..', '..', '..');
  const remoteIndex = fs.readFileSync(path.join(rootDir, 'apps', 'remote-app', 'pages', 'index.tsx'), 'utf-8');

  assert.match(remoteIndex, /className="session-banner"/);
  assert.match(remoteIndex, /data-testid="remote-active-session"/);
  assert.match(remoteIndex, /<ServerCard[^>]*session=\{session\}/);
});


