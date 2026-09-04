import React from 'react';
import { cookies } from 'next/headers';
import {
  parseSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
} from '@mfe/ui-shell';
import { getServerData } from '../../lib/getServerData';
import ServerCard from '../../components/ServerCard';
import RemoteTelemetry from '../../components/RemoteTelemetry';

export default async function MetricsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionFromCookieHeader(
    sessionCookie ? `${SESSION_COOKIE_NAME}=${sessionCookie}` : null
  );

  const serverData = await getServerData(session);

  return (
    <div className="metrics-page-container">
      <section className="host-section">
        <div className="section-header-flex">
          <div>
            <h2>Server Cache & Metrics Diagnostics (Zone 2)</h2>
            <p className="status-text">
              In-memory cache evaluation and stream performance
            </p>
          </div>
          <div className="active-route-pill">
            Path: <code>/remote-app/metrics</code>
          </div>
        </div>
      </section>

      <ServerCard
        initialData={serverData}
        session={session}
        title="Server Cache & Memory Diagnostics"
      />

      <div style={{ marginTop: '1.5rem' }}>
        <RemoteTelemetry filterLevel="warn" session={session} maxEvents={5} />
      </div>
    </div>
  );
}
