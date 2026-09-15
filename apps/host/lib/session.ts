import {
  PRESET_USERS,
  DEFAULT_SESSION,
  type UserSession,
  type UserRole,
} from '@mfe/shell-ui';

export {
  PRESET_USERS,
  DEFAULT_SESSION,
  type UserSession,
  type UserRole,
};

export function getSessionFromStorage(): UserSession {
  if (typeof window === 'undefined') return DEFAULT_SESSION;
  try {
    const raw = localStorage.getItem('host_user_session');
    if (!raw) return DEFAULT_SESSION;
    return JSON.parse(raw) as UserSession;
  } catch {
    return DEFAULT_SESSION;
  }
}

export function saveSessionToStorage(session: UserSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('host_user_session', JSON.stringify(session));
}
