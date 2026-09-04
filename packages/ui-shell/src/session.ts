export interface UserSession {
  readonly userId: string;
  readonly userName: string;
  readonly email: string;
  readonly role: 'admin' | 'operator' | 'viewer';
  readonly token: string;
}

export const PRESET_USERS: readonly UserSession[] = [
  {
    userId: 'admin-1',
    userName: 'Ana Souza',
    email: 'ana.souza@enterprise.com',
    role: 'admin',
    token: 'jwt_sec_admin_99214',
  },
  {
    userId: 'operator-2',
    userName: 'Carlos Mendes',
    email: 'carlos.mendes@enterprise.com',
    role: 'operator',
    token: 'jwt_sec_operator_48102',
  },
  {
    userId: 'viewer-3',
    userName: 'Mariana Lima',
    email: 'mariana.lima@enterprise.com',
    role: 'viewer',
    token: 'jwt_sec_viewer_19823',
  },
] as const;

export const DEFAULT_SESSION: UserSession = PRESET_USERS[0];
export const SESSION_COOKIE_NAME = 'mfe_user_session';

export function parseSessionString(raw: string | undefined | null): UserSession {
  if (!raw) return DEFAULT_SESSION;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (parsed && typeof parsed.userId === 'string' && typeof parsed.userName === 'string') {
      return parsed as UserSession;
    }
  } catch {
    // Fallback to default
  }
  return DEFAULT_SESSION;
}

export function parseSessionFromCookieHeader(cookieHeader: string | undefined | null): UserSession {
  if (!cookieHeader) return DEFAULT_SESSION;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return DEFAULT_SESSION;
  const value = match.substring(SESSION_COOKIE_NAME.length + 1);
  return parseSessionString(value);
}

export function setSessionCookie(session: UserSession): void {
  if (typeof document === 'undefined') return;
  const jsonStr = encodeURIComponent(JSON.stringify(session));
  document.cookie = `${SESSION_COOKIE_NAME}=${jsonStr}; path=/; max-age=86400; SameSite=Lax`;
  try {
    localStorage.setItem(SESSION_COOKIE_NAME, JSON.stringify(session));
  } catch {
    // Ignore storage quota
  }
}

export function getClientSession(): UserSession {
  if (typeof document === 'undefined') return DEFAULT_SESSION;
  try {
    const match = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) {
      return parseSessionString(match.substring(SESSION_COOKIE_NAME.length + 1));
    }
    const local = localStorage.getItem(SESSION_COOKIE_NAME);
    if (local) return parseSessionString(local);
  } catch {
    // Fallback
  }
  return DEFAULT_SESSION;
}
