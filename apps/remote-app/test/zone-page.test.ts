import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';

/**
 * The zone page is rendered for real, with the real server data, so taking the
 * shell chrome off `/remote-app` fails here and not only in a live check.
 *
 * The session the page mirrors from localStorage is read in an effect, which
 * react-dom/server never runs; the server render always shows the default
 * session. See D10 in .agents/orchestrator/DEFERRED.md.
 */

let html: string;

test.before(async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: RemoteHomePage } = await import('../pages/index.tsx');
  const { getServerData } = await import('../lib/getServerData.ts');

  html = renderToStaticMarkup(createElement(RemoteHomePage, { serverData: await getServerData() }));
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
