'use client';

import React from 'react';
import { ShellLayout, type UserSession } from '@mfe/shell-ui';
import { emitToast } from '../lib/events';
import { hostLog } from '../lib/logger';

interface HostLayoutProps {
  readonly children: React.ReactNode;
  readonly currentSession: UserSession;
  readonly onSessionChange: (session: UserSession) => void;
  readonly activeRoute?: string;
}

export const HostLayout: React.FC<HostLayoutProps> = ({
  children,
  currentSession,
  onSessionChange,
  activeRoute = '/',
}) => {
  const handleToastPing = () => {
    emitToast(
      'Host Notification',
      'Event triggered from Host Shell Header',
      'info'
    );
  };

  const handleNavigate = (label: string, destination: string) => {
    hostLog.client('NAVIGATE_ZONE_CLICK', { label, destination });
  };

  return (
    <ShellLayout
      currentSession={currentSession}
      onSessionChange={onSessionChange}
      onToastPing={handleToastPing}
      onNavigate={handleNavigate}
      activeRoute={activeRoute}
    >
      {children}
    </ShellLayout>
  );
};

export default HostLayout;
