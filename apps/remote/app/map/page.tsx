import React from 'react';
import { cookies } from 'next/headers';
import {
  parseSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
} from '@mfe/ui-shell';
import RemoteMap from '../../components/RemoteMap';

export default async function MapPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionFromCookieHeader(
    sessionCookie ? `${SESSION_COOKIE_NAME}=${sessionCookie}` : null
  );

  return (
    <div className="map-page-container">
      <section className="host-section">
        <div className="section-header-flex">
          <div>
            <h2>Fleet Map Visualization (Zone 2)</h2>
            <p className="status-text">
              WebGL-accelerated geospatial visualization powered by MapLibre GL
            </p>
          </div>
          <div className="active-route-pill">
            Path: <code>/remote-app/map</code>
          </div>
        </div>
      </section>

      <RemoteMap session={session} />
    </div>
  );
}
