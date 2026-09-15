import type { MapMarker } from '../types';

/** Pontos de demonstração do mapa; o `id` é o valor aceito em `?city=` e em `/mapa/[cidade]`. */
export const SAMPLE_MARKERS: readonly MapMarker[] = [
  {
    id: 'sao-paulo',
    name: 'São Paulo Fleet Center',
    lat: -23.5505,
    lng: -46.6333,
    status: 'active',
    description: 'South America Primary Gateway (42 active nodes)',
  },
  {
    id: 'san-francisco',
    name: 'San Francisco Hub',
    lat: 37.7749,
    lng: -122.4194,
    status: 'active',
    description: 'West Coast Cloud Backbone (128 active nodes)',
  },
  {
    id: 'london',
    name: 'London Exchange',
    lat: 51.5074,
    lng: -0.1278,
    status: 'warning',
    description: 'European Relay (Latency elevated +12ms)',
  },
  {
    id: 'tokyo',
    name: 'Tokyo Datacenter',
    lat: 35.6762,
    lng: 139.6503,
    status: 'active',
    description: 'APAC Primary Node (88 active nodes)',
  },
];
