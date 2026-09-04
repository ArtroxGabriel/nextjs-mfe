import React from 'react';
import { cookies } from 'next/headers';
import {
  parseSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
  remoteLog,
} from '@mfe/ui-shell';
import { getServerData } from '../lib/getServerData';
import ServerCard from '../components/ServerCard';

export default async function RemoteOverviewPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionFromCookieHeader(
    sessionCookie ? `${SESSION_COOKIE_NAME}=${sessionCookie}` : null
  );

  const serverData = await getServerData(session);

  remoteLog.server('REMOTE_ZONE_RSC_RENDER', {
    route: '/remote-app',
    user: session.userName,
    cached: serverData.cached,
    requestId: serverData.requestId,
  });

  return (
    <div className="remote-page-container">
      <section className="host-section">
        <div className="section-header-flex">
          <div>
            <h2>Zone 2 Remote Overview (App Router)</h2>
            <p className="status-text">
              Server-Side Rendered (RSC) at: <strong>{serverData.timestamp}</strong>
            </p>
          </div>
          <div className="active-route-pill">
            Path: <code>/remote-app</code> (Port 3001)
          </div>
        </div>
      </section>

      <ServerCard
        initialData={serverData}
        session={session}
        title="Zone 2 SSR Federated Diagnostic Card"
      />
    </div>
  );
}
