import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import '@mfe/ui-shell/src/styles/globals.css';
import { ShellLayout, parseSessionFromCookieHeader, SESSION_COOKIE_NAME } from '@mfe/ui-shell';

export const metadata: Metadata = {
  title: 'Enterprise Multi-Zone Gateway (Zone 1)',
  description: 'Next.js 16 Multi-Zones Host App Router Gateway',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionFromCookieHeader(sessionCookie ? `${SESSION_COOKIE_NAME}=${sessionCookie}` : null);

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"
        />
      </head>
      <body>
        <ShellLayout activeZone="host" currentPath="/" session={session}>
          {children}
        </ShellLayout>
      </body>
    </html>
  );
}
