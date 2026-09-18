import {
  PRESET_USERS,
  DEFAULT_SESSION,
  SESSION_STORAGE_KEY,
  parseSessionFromCookieHeader,
  writeSessionCookie,
  type UserSession,
  type UserRole,
} from '@mfe/shell-ui';

export {
  PRESET_USERS,
  DEFAULT_SESSION,
  SESSION_STORAGE_KEY,
  parseSessionFromCookieHeader,
  writeSessionCookie,
  type UserSession,
  type UserRole,
};

export function getSessionFromStorage(): UserSession {
  if (typeof window === 'undefined') return DEFAULT_SESSION;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return DEFAULT_SESSION;
    return JSON.parse(raw) as UserSession;
  } catch {
    return DEFAULT_SESSION;
  }
}

export function saveSessionToStorage(session: UserSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  writeSessionCookie(session);
}
