import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDashboardQuery, DASHBOARD_TABS, dashboardHref } from '../lib/dashboardQuery.ts';
import { SSE_EVENTS_PATH } from '../lib/sseUrl.ts';
import nextConfig from '../next.config.js';

test('sem query, o painel abre na aba overview, sem filtro e sem cidade', () => {
  assert.deepEqual(parseDashboardQuery({}), { tab: 'overview', filter: 'all', city: null });
});

test('tab, filter e city válidos vêm da query', () => {
  assert.deepEqual(parseDashboardQuery({ tab: 'telemetry', filter: 'warn' }), { tab: 'telemetry', filter: 'warn', city: null });
  assert.deepEqual(parseDashboardQuery({ tab: 'map', city: 'london' }), { tab: 'map', filter: 'all', city: 'london' });
});

test('valores desconhecidos, repetidos ou vazios caem no padrão em vez de chegar aos componentes', () => {
  assert.deepEqual(parseDashboardQuery({ tab: 'admin', filter: 'debug', city: 'atlantis' }), { tab: 'overview', filter: 'all', city: null });
  assert.deepEqual(parseDashboardQuery({ tab: ['map', 'telemetry'], city: '' }), { tab: 'overview', filter: 'all', city: null });
});

test('as abas oferecidas são as quatro da PoC', () => {
  assert.deepEqual([...DASHBOARD_TABS], ['overview', 'telemetry', 'map', 'metrics']);
});

test('os links das abas apontam para a zona com a query, incluindo o basePath', () => {
  assert.equal(dashboardHref({ tab: 'overview' }), '/remote-app');
  assert.equal(dashboardHref({ tab: 'telemetry', filter: 'warn' }), '/remote-app?tab=telemetry&filter=warn');
  assert.equal(dashboardHref({ tab: 'map', city: 'tokyo' }), '/remote-app/mapa/tokyo');
});

test('o SSE é pedido na mesma origem, dentro do basePath da zona', () => {
  const config = (nextConfig as { default?: { basePath: string } }).default ?? (nextConfig as { basePath: string });
  assert.equal(SSE_EVENTS_PATH, `${config.basePath}/api/sse-events`);
});
