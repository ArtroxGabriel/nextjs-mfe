import { PRESET_USERS, DEFAULT_SESSION, type UserSession } from './types';

export const SESSION_COOKIE_NAME = 'host_user_session';
export const SESSION_STORAGE_KEY = 'host_user_session';

function matchUserById(id: string): UserSession | undefined {
  return PRESET_USERS.find((user) => user.userId === id);
}

function extractUserIdFromCookieValue(rawValue: string): string {
  if (rawValue.startsWith('{') || rawValue.startsWith('%7B')) {
    try {
      const decoded = decodeURIComponent(rawValue);
      const parsed = JSON.parse(decoded) as Record<string, unknown>;
      if (typeof parsed.userId === 'string') {
        return parsed.userId;
      }
    } catch {
      return '';
    }
  }
  return decodeURIComponent(rawValue);
}

export function parseSessionFromCookieHeader(
  cookieHeader: string | undefined | null
): UserSession {
  if (!cookieHeader) {
    return DEFAULT_SESSION;
  }

  const entries = cookieHeader.split(';');
  for (const entry of entries) {
    const trimmed = entry.trim();
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex);
    if (key === SESSION_COOKIE_NAME) {
      const rawValue = trimmed.slice(separatorIndex + 1);
      const candidateId = extractUserIdFromCookieValue(rawValue);
      const matched = matchUserById(candidateId);
      if (matched) return matched;
    }
  }

  return DEFAULT_SESSION;
}

export function writeSessionCookie(session: UserSession): void {
  if (typeof document === 'undefined') {
    return;
  }
  try {
    document.cookie = `${SESSION_COOKIE_NAME}=${session.userId}; path=/; SameSite=Lax; max-age=31536000`;
  } catch {
    // ignore in restricted environments
  }
}
