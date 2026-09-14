import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';

/**
 * Exercises the real middleware.ts, with the real NextResponse, against a
 * stubbed zone health route. Only `fetch` and the clock are replaced.
 *
 * middleware.ts and the modules it pulls in need the resolution hooks above,
 * so they are loaded with dynamic imports after the hooks are registered.
 */

type MiddlewareModule = typeof import('../middleware.ts');
type NextServerModule = typeof import('next/server');

let middleware: MiddlewareModule['middleware'];
let matcher: readonly string[];
let resetLivenessCache: () => void;
let renderZoneErrorHtml: () => string;
let NextRequest: NextServerModule['NextRequest'];
let rewriteSources: string[];

test.before(async () => {
  const middlewareModule = await import('../middleware.ts');
  middleware = middlewareModule.middleware;
  matcher = middlewareModule.config.matcher;
  resetLivenessCache = (await import('../lib/zoneLiveness.ts')).__resetSharedZoneLivenessCacheForTests;
  renderZoneErrorHtml = (await import('../lib/zoneErrorPage.ts')).renderZoneErrorHtml;
  NextRequest = (await import('next/server')).NextRequest;

  const { default: nextConfig } = await import('../next.config.js');
  const rewrites = await nextConfig.rewrites?.();
  assert.ok(Array.isArray(rewrites), 'next.config.js rewrites() must return a flat array');
  rewriteSources = rewrites.map((rule) => rule.source);
});

const HEALTH_URL = 'http://localhost:3001/remote-app/api/health';
// Human decision, 2026-09-12: the window in which a fresh outage still reaches
// the dead zone is bounded at one second.
const EXPECTED_TTL_MS = 1000;

type ZoneState = 'up' | 'down' | 'erroring';

interface StubbedZone {
  set(state: ZoneState): void;
  readonly probedUrls: string[];
}

function stubZone(initial: ZoneState): StubbedZone {
  let state = initial;
  const probedUrls: string[] = [];
  mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    probedUrls.push(String(input));
    if (state === 'down') {
      throw new TypeError('fetch failed: connect ECONNREFUSED 127.0.0.1:3001');
    }
    return new Response(state === 'up' ? '{"ok":true}' : '', { status: state === 'up' ? 200 : 500 });
  });
  return {
    set(next: ZoneState) {
      state = next;
    },
    probedUrls,
  };
}

function zoneRequest(pathname = '/remote-app'): InstanceType<NextServerModule['NextRequest']> {
  return new NextRequest(`http://localhost:3000${pathname}`);
}

function isPassThrough(response: Response): boolean {
  return response.headers.get('x-middleware-next') === '1';
}

const ZONE_URL_VARIABLES = ['REMOTE_ZONE_URL', 'REMOTE_APP_URL'] as const;
const savedZoneUrls = new Map<string, string | undefined>();

test.beforeEach(() => {
  // The shared cache reads the zone origin from the environment when it is
  // built, so a CI run with these set must not change what the tests see.
  for (const name of ZONE_URL_VARIABLES) {
    savedZoneUrls.set(name, process.env[name]);
    delete process.env[name];
  }
  resetLivenessCache();
  mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
});

test.afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
  for (const name of ZONE_URL_VARIABLES) {
    const saved = savedZoneUrls.get(name);
    if (saved === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = saved;
    }
  }
});

test('the matcher covers exactly the paths the rewrites send to the zone', () => {
  assert.deepEqual([...matcher].sort(), [...rewriteSources].sort());
});

test('a healthy zone lets the request through to the rewrite', async () => {
  const zone = stubZone('up');

  const response = await middleware(zoneRequest('/remote-app/_fragmento/demo/42'));

  assert.ok(isPassThrough(response), 'expected NextResponse.next()');
  assert.deepEqual(zone.probedUrls, [HEALTH_URL]);
});

test('an unreachable zone gets the shell outage page as a 503, not the bare 500', async () => {
  stubZone('down');

  const response = await middleware(zoneRequest());

  assert.equal(isPassThrough(response), false);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(response.headers.get('retry-after') ?? '', /^[1-9]\d*$/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), renderZoneErrorHtml());
});

test('a zone whose health route answers non-2xx is treated as down', async () => {
  stubZone('erroring');

  const response = await middleware(zoneRequest('/remote-app-static/chunk.js'));

  assert.equal(response.status, 503);
});

test('an outage is detected once the liveness TTL of one second elapses, and not before', async () => {
  const zone = stubZone('up');

  assert.ok(isPassThrough(await middleware(zoneRequest())));
  zone.set('down');

  mock.timers.tick(EXPECTED_TTL_MS - 1);
  assert.ok(isPassThrough(await middleware(zoneRequest())), 'still inside the cached window');
  assert.equal(zone.probedUrls.length, 1, 'a request inside the window must not probe again');

  mock.timers.tick(1);
  assert.equal((await middleware(zoneRequest())).status, 503);
});

test('the shell recovers once the zone is back and the TTL elapses', async () => {
  const zone = stubZone('down');
  assert.equal((await middleware(zoneRequest())).status, 503);

  zone.set('up');
  mock.timers.tick(EXPECTED_TTL_MS);

  assert.ok(isPassThrough(await middleware(zoneRequest())));
});

test('the probe targets the same zone origin the rewrites use, REMOTE_ZONE_URL first', async () => {
  const zone = stubZone('up');
  process.env.REMOTE_ZONE_URL = 'http://zone-primary:4001';
  process.env.REMOTE_APP_URL = 'http://zone-fallback:4002';

  await middleware(zoneRequest());
  resetLivenessCache();
  delete process.env.REMOTE_ZONE_URL;
  await middleware(zoneRequest());

  assert.deepEqual(zone.probedUrls, [
    'http://zone-primary:4001/remote-app/api/health',
    'http://zone-fallback:4002/remote-app/api/health',
  ]);
});

test('a zone that never answers the probe gets the 503 in under a second and a half', { timeout: 5000 }, async () => {
  mock.method(globalThis, 'fetch', (_input: string | URL | Request, init?: RequestInit) => {
    // Packets dropped: no answer and no refusal, only the abort ends it.
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });
  });

  const startedAt = performance.now();
  const response = await middleware(zoneRequest());
  const elapsedMs = performance.now() - startedAt;

  assert.equal(response.status, 503);
  assert.ok(elapsedMs < 1500, `waited ${elapsedMs.toFixed(0)} ms for a silent zone`);
});
