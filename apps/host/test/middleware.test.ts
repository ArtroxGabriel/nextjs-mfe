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

test.beforeEach(() => {
  resetLivenessCache();
  mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
});

test.afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
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
