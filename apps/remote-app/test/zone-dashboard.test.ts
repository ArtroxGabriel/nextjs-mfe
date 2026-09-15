import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';

/**
 * As funcionalidades base da PoC dentro da zona: abas por query param
 * (`?tab=`, `?filter=`), rota de caminho (`/mapa/[cidade]`), telemetria SSE e
 * mapa. O conteúdo que chega por SSE e o motor do mapa rodam em efeitos, só no
 * navegador (D10); aqui se verifica o que o servidor entrega.
 */

type PageModule = typeof import('../pages/index.tsx');
type CityModule = typeof import('../pages/mapa/[cidade].tsx');

let page: PageModule;
let cityPage: CityModule;
let render: (dashboard: Record<string, unknown>) => Promise<string>;

test.before(async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { getServerData } = await import('../lib/getServerData.ts');
  page = await import('../pages/index.tsx');
  cityPage = await import('../pages/mapa/[cidade].tsx');
  const serverData = await getServerData();
  render = async (dashboard) => renderToStaticMarkup(createElement(page.default, { serverData, dashboard } as never));
});

async function propsFor(module: { getServerSideProps: unknown }, context: Record<string, unknown>) {
  const run = module.getServerSideProps as (ctx: unknown) => Promise<Record<string, unknown>>;
  return run({ query: {}, params: {}, req: {}, res: {}, resolvedUrl: '/', ...context });
}

test('a página lê tab e filter da query no servidor', async () => {
  const result = await propsFor(page, { query: { tab: 'telemetry', filter: 'warn' } });
  const props = result.props as { dashboard: unknown; serverData: unknown };

  assert.deepEqual(props.dashboard, { tab: 'telemetry', filter: 'warn', city: null });
  assert.ok(props.serverData);
});

test('as quatro abas são links <a> da zona, com a aba atual marcada', async () => {
  const html = await render({ tab: 'metrics', filter: 'all', city: null });
  const tabs = Array.from(html.matchAll(/<a href="([^"]+)" class="zone-tab( zone-tab-active)?"/g), (m) => [m[1], Boolean(m[2])]);

  assert.deepEqual(tabs, [
    ['/remote-app', false],
    ['/remote-app?tab=telemetry', false],
    ['/remote-app?tab=map', false],
    ['/remote-app?tab=metrics', true],
  ]);
});

test('overview mostra o card de SSR', async () => {
  const html = await render({ tab: 'overview', filter: 'all', city: null });
  assert.match(html, /<div class="federated-card">/);
  assert.doesNotMatch(html, /telemetry-card|map-card/);
});

test('telemetry mostra o card do stream SSE e os filtros por nível', async () => {
  const html = await render({ tab: 'telemetry', filter: 'warn', city: null });
  assert.match(html, /class="federated-card telemetry-card"/);
  assert.match(html, /<a href="\/remote-app\?tab=telemetry&amp;filter=warn" class="zone-filter zone-filter-active"/);
});

test('map mostra o mapa e, com cidade, já abre com ela selecionada', async () => {
  const html = await render({ tab: 'map', filter: 'all', city: 'london' });
  assert.match(html, /class="federated-card map-card"/);
  assert.match(html, /<div class="selected-marker-banner"><h4>London Exchange<\/h4>/);
  assert.match(html, /<a href="\/remote-app\/mapa\/tokyo" class="zone-city"/);
});

test('a rota de caminho /mapa/[cidade] abre o mapa na cidade do caminho', async () => {
  const result = await propsFor(cityPage, { params: { cidade: 'tokyo' } });
  assert.deepEqual((result.props as { dashboard: unknown }).dashboard, { tab: 'map', filter: 'all', city: 'tokyo' });
});

test('uma cidade desconhecida no caminho responde 404', async () => {
  assert.deepEqual(await propsFor(cityPage, { params: { cidade: 'atlantis' } }), { notFound: true });
});
