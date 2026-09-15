import test from 'node:test';
import assert from 'node:assert/strict';
import { decideZoneResponse, OUTAGE_RETRY_AFTER_SECONDS } from '../lib/zoneDecision.ts';
import { ZONE_ERROR_HEADING, ZONE_ERROR_MESSAGE } from '../lib/zoneErrorContent.ts';

// middleware.test.ts drives the real middleware end to end; these cover the
// pure decision it delegates to.

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
