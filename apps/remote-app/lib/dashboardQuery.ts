import { SAMPLE_MARKERS } from './mapMarkers.ts';

export const DASHBOARD_TABS = ['overview', 'telemetry', 'map', 'metrics'] as const;
export const TELEMETRY_FILTERS = ['all', 'info', 'warn', 'critical'] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];
export type TelemetryFilter = (typeof TELEMETRY_FILTERS)[number];

export interface DashboardQuery {
  readonly tab: DashboardTab;
  readonly filter: TelemetryFilter;
  readonly city: string | null;
}

type RawQuery = Readonly<Record<string, string | readonly string[] | undefined>>;

function pick<T extends string>(value: RawQuery[string], allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Lê `?tab=`, `?filter=` e `?city=`. Só valores conhecidos passam; o resto
 * (inclusive parâmetro repetido) vira o padrão, para que nada vindo da URL
 * chegue sem validação aos componentes.
 */
export function parseDashboardQuery(query: RawQuery): DashboardQuery {
  const cityIds = SAMPLE_MARKERS.map((marker) => marker.id);
  return {
    tab: pick(query.tab, DASHBOARD_TABS, 'overview'),
    filter: pick(query.filter, TELEMETRY_FILTERS, 'all'),
    city: pick<string>(query.city, cityIds, '') || null,
  };
}

/** Link de uma aba. A cidade usa a rota de caminho `/mapa/[cidade]`; o resto usa query. */
export function dashboardHref(target: { readonly tab: DashboardTab; readonly filter?: TelemetryFilter; readonly city?: string }): string {
  if (target.tab === 'map' && target.city) {
    return `/remote-app/mapa/${encodeURIComponent(target.city)}`;
  }
  const params = new URLSearchParams();
  if (target.tab !== 'overview') params.set('tab', target.tab);
  if (target.filter && target.filter !== 'all') params.set('filter', target.filter);
  const search = params.toString();
  return search ? `/remote-app?${search}` : '/remote-app';
}
