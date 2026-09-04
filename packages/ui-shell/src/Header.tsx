'use client';

import React, { useState, useEffect } from 'react';
import { PRESET_USERS, type UserSession, DEFAULT_SESSION, getClientSession, setSessionCookie } from './session';
import { emitToast } from './events';
import { hostLog } from './logger';

export interface HeaderProps {
  readonly initialSession?: UserSession;
  readonly activeZone?: 'host' | 'remote';
}

export const Header: React.FC<HeaderProps> = ({
  initialSession = DEFAULT_SESSION,
  activeZone = 'host',
}) => {
  const [session, setSession] = useState<UserSession>(initialSession);

  useEffect(() => {
    const current = getClientSession();
    if (current && current.userId !== session.userId) {
      setSession(current);
    }
  }, [session.userId]);

  const handleUserSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = PRESET_USERS.find((u) => u.userId === e.target.value);
    if (!selected) return;

    setSession(selected);
    setSessionCookie(selected);
    hostLog.client('SESSION_SWITCHED_MULTI_ZONE', {
      user: selected.userName,
      role: selected.role,
      zone: activeZone,
    });
    emitToast(
      'Session Switched (Cookie & Storage)',
      `Active identity: ${selected.userName} (${selected.role})`,
      'info'
    );
  };

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-logo">MZ</div>
        <div>
          <h1 className="brand-title">Next.js 16 Multi-Zones</h1>
          <span className="brand-subtitle">
            {activeZone === 'host' ? 'Zone 1: Host Gateway (Port 3000 -> /)' : 'Zone 2: Remote App (Port 3001 -> /remote-app)'}
          </span>
        </div>
      </div>

      <div className="header-actions">
        <div className="system-pill">
          <span className="status-dot dot-online" />
          <span>Active Zone: <strong>{activeZone.toUpperCase()}</strong></span>
        </div>

        <div className="session-selector">
          <label htmlFor="user-select" className="session-label">Session:</label>
          <select
            id="user-select"
            value={session.userId}
            onChange={handleUserSelect}
            className="session-dropdown"
          >
            {PRESET_USERS.map((user) => (
              <option key={user.userId} value={user.userId}>
                {user.userName} ({user.role})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="header-toast-btn"
          onClick={() => emitToast('Multi-Zone Ping', `Triggered from ${activeZone.toUpperCase()} Shell`, 'info')}
        >
          🔔 Ping Toast
        </button>
      </div>
    </header>
  );
};

export default Header;
