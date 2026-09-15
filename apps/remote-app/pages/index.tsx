import React, { useState, useEffect } from 'react';
import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { ShellLayout, DEFAULT_SESSION, type UserSession } from '@mfe/shell-ui';
import ServerCard from '../components/ServerCard';
import { getServerData } from '../lib/getServerData';
import type { ServerPayload } from '../types';

interface RemoteHomeProps {
  readonly serverData: ServerPayload;
}

const RemoteHomePage: NextPage<RemoteHomeProps> = ({ serverData }) => {
  const [session, setSession] = useState<UserSession>(DEFAULT_SESSION);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('host_user_session');
      if (raw) {
        const parsed = JSON.parse(raw) as UserSession;
        if (parsed.userId) {
          setSession(parsed);
        }
      }
    } catch {
      // localStorage unavailable during SSR or restricted context
    }
  }, []);

  const handleSessionChange = (nextSession: UserSession) => {
    setSession(nextSession);
    try {
      localStorage.setItem('host_user_session', JSON.stringify(nextSession));
    } catch {
      // localStorage write fallback
    }
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

          <ServerCard initialData={serverData} title="Remote Standalone SSR Card" session={session} />
        </div>
      </ShellLayout>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<RemoteHomeProps> = async () => {
  const serverData = await getServerData();
  return {
    props: {
      serverData,
    },
  };
};

export default RemoteHomePage;
