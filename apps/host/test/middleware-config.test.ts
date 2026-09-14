import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ZONE_MATCHER_PATHS,
  decideZoneResponse,
  OUTAGE_RETRY_AFTER_SECONDS,
} from '../lib/zoneDecision.ts';
import {
  ZONE_ERROR_HEADING,
  ZONE_ERROR_MESSAGE,
} from '../lib/zoneErrorContent.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIDDLEWARE_PATH = path.join(__dirname, '..', 'middleware.ts');

function readMiddlewareSource(): string {
  assert.ok(fs.existsSync(MIDDLEWARE_PATH), `expected ${MIDDLEWARE_PATH} to exist`);
  return fs.readFileSync(MIDDLEWARE_PATH, 'utf-8');
}

test('middleware.ts exists at the host app root', () => {
  assert.ok(fs.existsSync(MIDDLEWARE_PATH));
});

test('matcher covers the zone root, zone sub-routes, and zone static assets with static literals', () => {
  assert.deepEqual(ZONE_MATCHER_PATHS, [
    '/remote-app',
    '/remote-app/:path*',
    '/remote-app-static/:path*',
  ]);

  const source = readMiddlewareSource();
  assert.match(source, /matcher\s*:\s*\[/, 'middleware.ts must export static literal array for Next.js AST parser');
  assert.match(source, /['"]\/remote-app['"]/, 'matcher must explicitly contain /remote-app');
  assert.match(source, /['"]\/remote-app\/:path\*['"]/, 'matcher must explicitly contain /remote-app/:path*');
  assert.match(source, /['"]\/remote-app-static\/:path\*['"]/, 'matcher must explicitly contain /remote-app-static/:path*');
});

test('decideZoneResponse returns next when zone is healthy', () => {
  const decision = decideZoneResponse(true);

  assert.equal(decision.action, 'next', 'healthy zone must proceed to next handler');
  assert.equal(Object.keys(decision).length, 1);
});

test('decideZoneResponse returns 503 with Retry-After and inert outage page when zone is down', () => {
  const decision = decideZoneResponse(false);

  assert.equal(decision.action, 'outage', 'unhealthy zone must return outage response');
  if (decision.action === 'outage') {
    assert.equal(decision.status, 503, 'the deliberate outage status code must be 503 (dependency down), not a bare 500');
    assert.equal(decision.headers['retry-after'], OUTAGE_RETRY_AFTER_SECONDS);
    assert.equal(decision.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(decision.headers['cache-control'], 'no-store');
    assert.ok(decision.body.includes(ZONE_ERROR_HEADING), 'outage body must include shared heading');
    assert.ok(decision.body.includes(ZONE_ERROR_MESSAGE), 'outage body must include shared message');
    assert.doesNotMatch(decision.body, /<script\b/i, 'outage body must be inert with no script tags');
  }
});

test('middleware.ts delegates decision to decideZoneResponse and getSharedZoneLivenessCache', () => {
  const source = readMiddlewareSource();

  assert.match(
    source,
    /getSharedZoneLivenessCache/,
    'middleware must delegate the outage decision to the cached liveness module, not re-implement probing'
  );
  assert.match(
    source,
    /decideZoneResponse/,
    'middleware must delegate routing decision to decideZoneResponse'
  );
  assert.match(
    source,
    /if\s*\(\s*decision\.action\s*===\s*['"]next['"]\s*\)/,
    'middleware must branch on decision.action === next'
  );
});
