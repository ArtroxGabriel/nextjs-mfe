import React from 'react';
import { cookies } from 'next/headers';
import {
  parseSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
  hostLog,
} from '@mfe/ui-shell';

export default async function HostHomePage() {
  const renderTimestamp = new Date().toISOString();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionFromCookieHeader(
    sessionCookie ? `${SESSION_COOKIE_NAME}=${sessionCookie}` : null
  );

  hostLog.server('HOST_ZONE_RSC_RENDER', {
    route: '/',
    user: session.userName,
    role: session.role,
    node: process.version,
  });

  return (
    <div className="host-page-container">
      <section className="host-section">
        <div className="section-header-flex">
          <div>
            <h2>Enterprise Multi-Zone Gateway (Zone 1)</h2>
            <p className="status-text">
              Server-Side Rendered (RSC) at: <strong>{renderTimestamp}</strong>
            </p>
          </div>
          <div className="active-route-pill">
            Path: <code>/</code> (Port 3000)
          </div>
        </div>
      </section>

      <div className="federated-card">
        <header className="federated-card-header">
          <span className="badge">Multi-Zone Gateway</span>
          <h3 className="card-title">Zone 1 Host Architecture Diagnostics</h3>
        </header>

        <div className="card-body">
          <div className="session-banner">
            <span className="session-badge">Secure Server Identity</span>
            <p>
              Authenticated as: <strong>{session.userName}</strong> ({session.email}) | Role:{' '}
              <span className={`role-tag role-${session.role}`}>{session.role}</span>
            </p>
          </div>

          <dl className="data-grid">
            <div className="data-row">
              <dt>Architecture Pattern:</dt>
              <dd className="data-value highlight">Next.js 16 Multi-Zones (Reverse Proxy / MPA)</dd>
            </div>
            <div className="data-row">
              <dt>Rendering Engine:</dt>
              <dd className="data-value">React 19 Server Components (RSC / App Router)</dd>
            </div>
            <div className="data-row">
              <dt>Zone 1 (Host Scope):</dt>
              <dd className="data-value mono">http://localhost:3000/ (Rewrites /remote-app/*)</dd>
            </div>
            <div className="data-row">
              <dt>Zone 2 (Remote Target):</dt>
              <dd className="data-value mono">http://localhost:3001/remote-app/*</dd>
            </div>
            <div className="data-row">
              <dt>Node.js Runtime:</dt>
              <dd className="data-value">{process.version} ({process.platform} - {process.arch})</dd>
            </div>
          </dl>

          <div className="interactive-section">
            <span className="status-text">
              Ready to transition between zones with zero Webpack Federation overhead.
            </span>
            <a href="/remote-app" className="action-btn">
              Explore Zone 2 Remote App &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
