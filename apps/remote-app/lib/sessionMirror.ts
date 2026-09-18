import { writeSessionCookie, SESSION_STORAGE_KEY, type UserSession } from '@mfe/shell-ui';

/** Chave que o shell usa no localStorage; a zona só espelha o que o shell gravou (D3). */
export const SESSION_MIRROR_KEY = SESSION_STORAGE_KEY;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Sessão gravada pelo shell, ou `null` se não houver, estiver ilegível ou sem `userId`. */
export function readMirroredSession(storage: StorageLike): UserSession | null {
  try {
    const raw = storage.getItem(SESSION_MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserSession | null;
    return parsed && parsed.userId ? parsed : null;
  } catch {
    return null;
  }
}

/** Grava a sessão escolhida na zona para o shell (e outras zonas) lerem. Falha de storage é ignorada. */
export function writeMirroredSession(storage: StorageLike, session: UserSession): void {
  try {
    storage.setItem(SESSION_MIRROR_KEY, JSON.stringify(session));
  } catch {
    // storage indisponível (modo privado, cota): a sessão continua só na memória da página
  }
  writeSessionCookie(session);
}
