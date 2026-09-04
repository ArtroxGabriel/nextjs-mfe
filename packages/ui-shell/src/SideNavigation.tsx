'use client';

import React from 'react';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  readonly zone: 'Zone 1 (Host)' | 'Zone 2 (Remote)';
  readonly description: string;
}

export const MULTI_ZONE_NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'host-root',
    label: 'Host Gateway (SSR)',
    href: '/',
    icon: '🏛️',
    zone: 'Zone 1 (Host)',
    description: 'Host App Router root (Port 3000)',
  },
  {
    id: 'remote-overview',
    label: 'Remote SSR Overview',
    href: '/remote-app',
    icon: '📊',
    zone: 'Zone 2 (Remote)',
    description: 'Remote App Router root (/remote-app)',
  },
  {
    id: 'remote-telemetry',
    label: 'Live Telemetry (SSE)',
    href: '/remote-app/telemetry',
    icon: '⚡',
    zone: 'Zone 2 (Remote)',
    description: 'Real-time Server-Sent Events stream',
  },
  {
    id: 'remote-map',
    label: 'Fleet Map (MapLibre)',
    href: '/remote-app/map',
    icon: '🗺️',
    zone: 'Zone 2 (Remote)',
    description: 'MapLibre GL client route',
  },
  {
    id: 'remote-metrics',
    label: 'Server Cache & State',
    href: '/remote-app/metrics',
    icon: '⚙️',
    zone: 'Zone 2 (Remote)',
    description: 'Memory cache & node runtime diagnostics',
  },
] as const;

export interface SideNavigationProps {
  readonly currentPath?: string;
  readonly activeZone?: 'host' | 'remote';
}

export const SideNavigation: React.FC<SideNavigationProps> = ({
  currentPath = '/',
}) => {
  return (
    <nav className="side-navigation" aria-label="Main Navigation">
      <div className="nav-section-title">Multi-Zone Routing</div>
      <ul className="nav-list">
        {MULTI_ZONE_NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <li key={item.id} className="nav-item">
              <a
                href={item.href}
                className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <div className="nav-text-block">
                  <div className="nav-title-row">
                    <span className="nav-title">{item.label}</span>
                    <span className="zone-pill">{item.zone}</span>
                  </div>
                  <span className="nav-description">{item.description}</span>
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      <div className="nav-footer">
        <div className="nav-badge-box">
          <small className="nav-badge-title">Next.js 16 Multi-Zones</small>
          <p className="nav-badge-desc">Native Reverse Proxy & App Router</p>
        </div>
      </div>
    </nav>
  );
};

export default SideNavigation;
