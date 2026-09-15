import React from 'react';
import {
  DASHBOARD_TABS,
  TELEMETRY_FILTERS,
  dashboardHref,
  type DashboardQuery,
} from '../lib/dashboardQuery';
import { SAMPLE_MARKERS } from '../lib/mapMarkers';

const TAB_LABELS: Readonly<Record<DashboardQuery['tab'], string>> = {
  overview: 'Visão geral (SSR)',
  telemetry: 'Telemetria (SSE)',
  map: 'Mapa (MapLibre)',
  metrics: 'Métricas',
};

/**
 * Navegação do painel da zona. São links `<a>` comuns: cada clique é um novo
 * pedido ao servidor, que lê a query ou o caminho e renderiza a aba.
 */
export const DashboardTabs = ({ dashboard }: { readonly dashboard: DashboardQuery }): React.ReactElement => (
  <nav className="zone-tabs" aria-label="Abas do painel">
    <div className="zone-tab-row">
      {DASHBOARD_TABS.map((tab) => (
        <a key={tab} href={dashboardHref({ tab })} className={`zone-tab${tab === dashboard.tab ? ' zone-tab-active' : ''}`}>
          {TAB_LABELS[tab]}
        </a>
      ))}
    </div>

    {dashboard.tab === 'telemetry' && (
      <div className="zone-tab-row">
        <span className="zone-tab-label">Filtro (?filter=):</span>
        {TELEMETRY_FILTERS.map((filter) => (
          <a
            key={filter}
            href={dashboardHref({ tab: 'telemetry', filter })}
            className={`zone-filter${filter === dashboard.filter ? ' zone-filter-active' : ''}`}
          >
            {filter}
          </a>
        ))}
      </div>
    )}

    {dashboard.tab === 'map' && (
      <div className="zone-tab-row">
        <span className="zone-tab-label">Cidade (/mapa/[cidade]):</span>
        {SAMPLE_MARKERS.map((marker) => (
          <a
            key={marker.id}
            href={dashboardHref({ tab: 'map', city: marker.id })}
            className={`zone-city${marker.id === dashboard.city ? ' zone-city-active' : ''}`}
          >
            {marker.id}
          </a>
        ))}
      </div>
    )}
  </nav>
);

export default DashboardTabs;
