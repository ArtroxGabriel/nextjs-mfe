import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';

type Mirror = typeof import('../lib/sessionMirror.ts');
let mirror: Mirror;
let presets: typeof import('@mfe/shell-ui')['PRESET_USERS'];

test.before(async () => {
  mirror = await import('../lib/sessionMirror.ts');
  presets = (await import('@mfe/shell-ui')).PRESET_USERS;
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

test('a zona lê a sessão que o shell gravou na chave compartilhada', () => {
  const viewer = presets[2]!;
  const storage = memoryStorage({ host_user_session: JSON.stringify(viewer) });

  assert.equal(mirror.SESSION_MIRROR_KEY, 'host_user_session');
  assert.deepEqual(mirror.readMirroredSession(storage), viewer);
});

test('sem valor, JSON inválido, null ou sem userId, a leitura devolve null', () => {
  for (const value of [undefined, '{', 'null', '{"userName":"x"}']) {
    const storage = memoryStorage(value === undefined ? {} : { host_user_session: value });
    assert.equal(mirror.readMirroredSession(storage), null, `valor ${String(value)}`);
  }
});

test('a escolha feita na zona é gravada na chave compartilhada', () => {
  const storage = memoryStorage();
  mirror.writeMirroredSession(storage, presets[1]!);

  assert.deepEqual(JSON.parse(storage.data.get('host_user_session')!), presets[1]);
});

test('storage que lança não derruba a página', () => {
  const broken = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(mirror.readMirroredSession(broken), null);
  assert.doesNotThrow(() => mirror.writeMirroredSession(broken, presets[0]!));
});
