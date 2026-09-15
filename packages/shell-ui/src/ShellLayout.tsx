import React from 'react';
import Header from './Header';
import SideNavigation from './SideNavigation';
import ToastContainer from './ToastContainer';
import type { UserSession } from './types';

export interface ShellLayoutProps {
  readonly children: React.ReactNode;
  readonly currentSession?: UserSession | undefined;
  readonly onSessionChange?: ((session: UserSession) => void) | undefined;
  readonly activeRoute?: string | undefined;
  readonly onNavigate?: ((label: string, destination: string) => void) | undefined;
  readonly onToastPing?: (() => void) | undefined;
  readonly brandTitle?: string | undefined;
  readonly brandSubtitle?: string | undefined;
  readonly systemPillText?: string | undefined;
  readonly showToastButton?: boolean | undefined;
}

export const ShellLayout = ({
  children,
  currentSession,
  onSessionChange,
  activeRoute = '/',
  onNavigate,
  onToastPing,
  brandTitle,
  brandSubtitle,
  systemPillText,
  showToastButton,
}: ShellLayoutProps): React.ReactElement => {
  return (
    <div className="layout-root">
      <Header
        currentSession={currentSession}
        onSessionChange={onSessionChange}
        onToastPing={onToastPing}
        brandTitle={brandTitle}
        brandSubtitle={brandSubtitle}
        systemPillText={systemPillText}
        showToastButton={showToastButton}
      />

      <div className="layout-body">
        <aside className="layout-sidebar">
          <SideNavigation
            activeRoute={activeRoute}
            onNavigate={onNavigate}
          />
        </aside>

        <main className="layout-main">
          {children}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};

export default ShellLayout;
