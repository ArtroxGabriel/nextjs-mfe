import React from 'react';
import { cookies } from 'next/headers';
import {
  parseSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
} from '@mfe/ui-shell';
import RemoteTelemetry from '../../components/RemoteTelemetry';

export default async function TelemetryPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionFromCookieHeader(
    sessionCookie ? `${SESSION_COOKIE_NAME}=${sessionCookie}` : null
  );

  return (
    <div className="telemetry-page-container">
      <section className="host-section">
        <div className="section-header-flex">
          <div>
            <h2>Real-time Stream Telemetry (Zone 2)</h2>
            <p className="status-text">
              Direct EventStream connection via Next.js 16 Route Handlers
            </p>
          </div>
          <div className="active-route-pill">
            Path: <code>/remote-app/telemetry</code>
          </div>
        </div>
      </section>

      <RemoteTelemetry session={session} />
    </div>
  );
}
