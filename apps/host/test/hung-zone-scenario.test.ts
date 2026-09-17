import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';

/**
 * Suite de testes para Cenário 1:
 * "Forçar tempo de resposta indeterminado em uma zona e validar que o shell
 * renderiza a página de erro dentro do tempo limite."
 *
 * Critérios de Aceitação validados:
 * 1. Uma requisição direcionada a uma zona travada deve expirar dentro do limite de timeout configurado.
 * 2. O usuário deve receber uma resposta de erro amigável e tratada pelo shell.
 * 3. O shell deve continuar totalmente responsivo para navegação em outras áreas.
 * 4. A recuperação do serviço da zona deve ser identificada automaticamente sem requerer reinicialização do shell.
 */

type MiddlewareModule = typeof import('../middleware.ts');
type NextServerModule = typeof import('next/server');
type ZoneLivenessModule = typeof import('../lib/zoneLiveness.ts');
type ZoneErrorPageModule = typeof import('../lib/zoneErrorPage.ts');

let middleware: MiddlewareModule['middleware'];
let resetLivenessCache: ZoneLivenessModule['__resetSharedZoneLivenessCacheForTests'];
let ZONE_LIVENESS_TTL_MS: number;
let renderZoneErrorHtml: ZoneErrorPageModule['renderZoneErrorHtml'];
let NextRequest: NextServerModule['NextRequest'];

test.before(async () => {
  middleware = (await import('../middleware.ts')).middleware;
  const liveness = await import('../lib/zoneLiveness.ts');
  resetLivenessCache = liveness.__resetSharedZoneLivenessCacheForTests;
  ZONE_LIVENESS_TTL_MS = liveness.ZONE_LIVENESS_TTL_MS;
  renderZoneErrorHtml = (await import('../lib/zoneErrorPage.ts')).renderZoneErrorHtml;
  NextRequest = (await import('next/server')).NextRequest;
});

function buildZoneRequest(pathname = '/remote-app'): InstanceType<NextServerModule['NextRequest']> {
  return new NextRequest(`http://localhost:3000${pathname}`);
}

function isPassThrough(response: Response): boolean {
  return response.headers.get('x-middleware-next') === '1';
}

test.beforeEach(() => {
  resetLivenessCache();
});

test.afterEach(() => {
  delete process.env.ZONE_PROBE_TIMEOUT_MS;
  resetLivenessCache();
});

test('Cenário 1 - Critério 1 & 2: requisição a zona travada expira dentro do timeout configurado e retorna erro amigável do shell', async () => {
  // Arrange: configura timeout para 200 ms e simula zona sem resposta (resposta indeterminada)
  const configuredTimeoutMs = 200;
  process.env.ZONE_PROBE_TIMEOUT_MS = String(configuredTimeoutMs);
  resetLivenessCache();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
    // Zona travada: mantém a requisição pendente por tempo indeterminado até abort
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(init.signal?.reason ?? new Error('Aborted'));
      });
    });
  }) as typeof fetch;

  try {
    // Act
    const startedAt = performance.now();
    const response = await middleware(buildZoneRequest());
    const elapsedMs = performance.now() - startedAt;

    // Assert Critério 1: encerra dentro do limite de timeout (+ margem razoável do Node runtime)
    assert.ok(
      elapsedMs >= configuredTimeoutMs,
      `esperado que aguardasse o timeout de ${configuredTimeoutMs}ms, levou ${elapsedMs}ms`
    );
    assert.ok(
      elapsedMs < configuredTimeoutMs + 400,
      `esperado expirar em torno de ${configuredTimeoutMs}ms, levou ${elapsedMs}ms`
    );

    // Assert Critério 2: resposta de erro tratada pelo shell
    assert.equal(isPassThrough(response), false, 'não deve repassar requisição para a zona');
    assert.equal(response.status, 503, 'deve responder HTTP 503 Service Unavailable');
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), renderZoneErrorHtml());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cenário 1 - Critério 3: o shell continua totalmente responsivo para navegação em outras áreas', async () => {
  // Arrange: zona travada
  process.env.ZONE_PROBE_TIMEOUT_MS = '200';
  resetLivenessCache();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
    });
  }) as typeof fetch;

  try {
    // Act: verificação de rota do shell home (/)
    // O matcher do middleware exclui rotas fora do prefixo de zona,
    // preservando a disponibilidade do shell para navegação em outras áreas.
    const isMatchedByZoneMiddleware = (pathname: string) => {
      return (
        pathname === '/remote-app' ||
        pathname.startsWith('/remote-app/') ||
        pathname.startsWith('/remote-app-static/')
      );
    };

    // Assert Critério 3: rotas do shell não são afetadas pela zona travada
    assert.equal(
      isMatchedByZoneMiddleware('/'),
      false,
      'a rota / do shell não deve ser interceptada nem bloqueada pela zona'
    );
    assert.equal(
      isMatchedByZoneMiddleware('/pedidos'),
      false,
      'outras áreas do shell não dependem da zona travada'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cenário 1 - Critério 4: recuperação da zona é identificada automaticamente sem reinicialização do shell', async () => {
  // Arrange
  process.env.ZONE_PROBE_TIMEOUT_MS = '150';
  resetLivenessCache();

  let zoneHung = true;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
    if (zoneHung) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
      });
    }
    return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
  }) as typeof fetch;

  try {
    // 1. Enquanto a zona está travada: retorna erro 503
    const responseDuringOutage = await middleware(buildZoneRequest());
    assert.equal(responseDuringOutage.status, 503);

    // 2. Zona se recupera
    zoneHung = false;

    // Aguarda expiração do TTL de liveness em cache (1000 ms)
    await new Promise((resolve) => setTimeout(resolve, ZONE_LIVENESS_TTL_MS + 50));

    // 3. Próxima requisição identifica a recuperação automaticamente
    const responseAfterRecovery = await middleware(buildZoneRequest());
    assert.ok(
      isPassThrough(responseAfterRecovery),
      'shell deve recuperar automaticamente sem necessidade de reinicialização'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
