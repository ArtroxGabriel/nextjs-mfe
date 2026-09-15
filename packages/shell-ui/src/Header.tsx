import React from 'react';
import { PRESET_USERS, DEFAULT_SESSION, type UserSession } from './types';
import { emitToast } from './events';

export interface HeaderProps {
  readonly currentSession?: UserSession | undefined;
  readonly onSessionChange?: ((session: UserSession) => void) | undefined;
  readonly onToastPing?: (() => void) | undefined;
  readonly brandTitle?: string | undefined;
  readonly brandSubtitle?: string | undefined;
  readonly systemPillText?: string | undefined;
  readonly showToastButton?: boolean | undefined;
}

export const Header = ({
  currentSession = DEFAULT_SESSION,
  onSessionChange,
  onToastPing,
  brandTitle = 'Enterprise MFE Host',
  brandSubtitle = 'Next.js Multi-Zones Shell (Port 3000)',
  systemPillText = 'Multi-Zones Gateway (Port 3000)',
  showToastButton = true,
}: HeaderProps): React.ReactElement => {
  const handleUserSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = PRESET_USERS.find((u) => u.userId === e.target.value);
    if (!selected) return;
    onSessionChange?.(selected);
  };

  const handlePing = () => {
    if (onToastPing) {
      onToastPing();
    } else {
      emitToast(
        'Shell Notification',
        `Ping from ${brandTitle} Header`,
        'info'
      );
    }
  };

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-logo">MFE</div>
        <div>
          <h1 className="brand-title">{brandTitle}</h1>
          <span className="brand-subtitle">{brandSubtitle}</span>
        </div>
      </div>

      <div className="header-actions">
        <div className="system-pill">
          <span className="status-dot dot-online" />
          <span>{systemPillText}</span>
        </div>

        <div className="session-selector">
          <label htmlFor="user-select" className="session-label">Session:</label>
          <select
            id="user-select"
            value={currentSession.userId}
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

        {showToastButton && (
          <button
            type="button"
            className="header-toast-btn"
            onClick={handlePing}
          >
            🔔 Ping Toast
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
