import React from 'react';
import Header from './Header';
import SideNavigation from './SideNavigation';
import ToastContainer from './ToastContainer';
import type { UserSession } from './session';

export interface ShellLayoutProps {
  readonly children: React.ReactNode;
  readonly activeZone?: 'host' | 'remote';
  readonly currentPath?: string;
  readonly session?: UserSession;
}

export const ShellLayout: React.FC<ShellLayoutProps> = ({
  children,
  activeZone = 'host',
  currentPath = '/',
  session,
}) => {
  return (
    <div className="app-shell-root">
      <Header initialSession={session} activeZone={activeZone} />
      <div className="app-layout-body">
        <SideNavigation currentPath={currentPath} activeZone={activeZone} />
        <main className="app-main-content">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};

export default ShellLayout;
