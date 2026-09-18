import React, { useState, useEffect } from 'react';
import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import {
  ShellLayout,
  DEFAULT_SESSION,
  parseSessionFromCookieHeader,
  writeSessionCookie,
  type UserSession,
} from '@mfe/shell-ui';
import RemoteDashboard from '../components/RemoteDashboard';
import DashboardTabs from '../components/DashboardTabs';
import { parseDashboardQuery, type DashboardQuery } from '../lib/dashboardQuery';
import { readMirroredSession, writeMirroredSession } from '../lib/sessionMirror';
import { getServerData } from '../lib/getServerData';
import type { ServerPayload } from '../types';

export interface RemoteHomeProps {
  readonly serverData: ServerPayload;
  readonly dashboard: DashboardQuery;
  readonly initialSession?: UserSession;
}

// Em modo privado ou com cookies bloqueados, só ler `window.localStorage` já lança.
function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const RemoteHomePage: NextPage<RemoteHomeProps> = ({
  serverData,
  dashboard,
  initialSession = DEFAULT_SESSION,
}) => {
  const [session, setSession] = useState<UserSession>(initialSession);

  useEffect(() => {
    const storage = browserStorage();
    const mirrored = storage && readMirroredSession(storage);
    if (mirrored && mirrored.userId !== session.userId) {
      setSession(mirrored);
    }
  }, [session.userId]);

  const handleSessionChange = (nextSession: UserSession) => {
    setSession(nextSession);
    const storage = browserStorage();
    if (storage) {
      writeMirroredSession(storage, nextSession);
    }
    writeSessionCookie(nextSession);
  };

  return (
    <>
      <Head>
        <title>Remote App (Port 3001)</title>
        <meta name="description" content="Remote Micro-Frontend App" />
      </Head>

      <ShellLayout
        currentSession={session}
        onSessionChange={handleSessionChange}
        activeRoute="/remote-app"
      >
        <div className="container">
          <header className="header">
            <h1>Remote Standalone Application</h1>
            <p>Running natively on port 3001 using Next.js 15 Pages Router with SSR.</p>
          </header>

          <div className="session-banner" data-testid="remote-active-session">
            <span className="session-badge">Active Zone Session</span>
            <p>
              User: <strong>{session.userName}</strong> ({session.email}) | Tenant: <code>{session.tenant}</code> | Role:{' '}
              <span className={`role-tag role-${session.role}`}>{session.role}</span>
            </p>
          </div>

          <DashboardTabs dashboard={dashboard} />

          <RemoteDashboard
            activeTab={dashboard.tab}
            serverData={serverData}
            session={session}
            queryParams={{ filter: dashboard.filter, ...(dashboard.city ? { city: dashboard.city } : {}) }}
          />
        </div>
      </ShellLayout>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<RemoteHomeProps> = async (context) => {
  const session = parseSessionFromCookieHeader(context.req?.headers?.cookie);
  const serverData = await getServerData(session);
  return {
    props: {
      serverData,
      dashboard: parseDashboardQuery(context.query),
      initialSession: session,
    },
  };
};

export default RemoteHomePage;
