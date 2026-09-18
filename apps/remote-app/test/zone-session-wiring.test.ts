import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import './support/register-next-resolution.ts';

/**
 * O handler de sessão da página da zona é criado dentro de um componente com
 * hooks, então não dá para chamar a página como função. Para vê-lo, este teste
 * envolve `jsx`/`jsxs` do `react/jsx-runtime` ANTES de qualquer módulo ES
 * importá-lo (o import ES de um módulo CommonJS copia as exportações na
 * primeira carga), renderiza a página de verdade e guarda as props entregues ao
 * ShellLayout. Se a ordem de carga mudar, a captura fica vazia e o teste falha,
 * não passa em silêncio.
 */

const require = createRequire(import.meta.url);
const runtime = require('react/jsx-runtime') as Record<string, (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown>;
const captured: Record<string, unknown>[] = [];
for (const name of ['jsx', 'jsxs'] as const) {
  const original = runtime[name]!;
  runtime[name] = (type, props, key) => {
    if (typeof type === 'function' && type.name === 'ShellLayout') {
      captured.push(props);
    }
    return original(type, props, key);
  };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

test('escolher um usuário no header da zona grava a sessão para o shell', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: RemoteHomePage } = await import('../pages/index.tsx');
  const { getServerData } = await import('../lib/getServerData.ts');
  const { parseDashboardQuery } = await import('../lib/dashboardQuery.ts');
  const { PRESET_USERS } = await import('@mfe/shell-ui');

  renderToStaticMarkup(createElement(RemoteHomePage, { serverData: await getServerData(), dashboard: parseDashboardQuery({}) }));

  assert.equal(captured.length, 1, 'a página deve renderizar exatamente um ShellLayout');
  const onSessionChange = captured[0]!.onSessionChange as ((s: unknown) => void) | undefined;
  assert.equal(typeof onSessionChange, 'function', 'a página deve entregar onSessionChange ao ShellLayout');

  const storage = memoryStorage();
  const fakeDoc = { cookie: '' };
  const saved = (globalThis as { window?: unknown }).window;
  const savedDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  (globalThis as { document?: unknown }).document = fakeDoc;
  try {
    onSessionChange!(PRESET_USERS[2]);
  } finally {
    (globalThis as { window?: unknown }).window = saved;
    (globalThis as { document?: unknown }).document = savedDoc;
  }

  assert.deepEqual(JSON.parse(storage.data.get('host_user_session') ?? 'null'), PRESET_USERS[2]);
  assert.match(fakeDoc.cookie, /^host_user_session=usr_viewer_03;/);
  assert.match(fakeDoc.cookie, /path=\//);
  assert.match(fakeDoc.cookie, /SameSite=Lax/);
});
