import { renderZoneErrorHtml } from './zoneErrorPage.ts';

export const ZONE_MATCHER_PATHS = [
  '/remote-app',
  '/remote-app/:path*',
  '/remote-app-static/:path*',
] as const;

export const OUTAGE_RETRY_AFTER_SECONDS = '5';

export interface ZoneDecisionNext {
  readonly action: 'next';
}

export interface ZoneDecisionOutage {
  readonly action: 'outage';
  readonly status: 503;
  readonly headers: {
    readonly 'content-type': 'text/html; charset=utf-8';
    readonly 'retry-after': string;
    readonly 'cache-control': 'no-store';
  };
  readonly body: string;
}

export type ZoneDecision = ZoneDecisionNext | ZoneDecisionOutage;

/**
 * Pure, importable decision logic for Multi-Zones request routing.
 *
 * Given the zone liveness verdict, returns either an instruction to proceed to
 * the rewrite target (`action: 'next'`), or a complete 503 outage response
 * containing status, headers, and pre-rendered inert HTML (`action: 'outage'`).
 *
 * Extracted so that this decision is directly testable under any test runner
 * without requiring the Next.js runtime or `next/server` bundling.
 *
 * @example
 * decideZoneResponse(true) // -> { action: 'next' }
 * decideZoneResponse(false) // -> { action: 'outage', status: 503, ... }
 */
export function decideZoneResponse(isZoneHealthy: boolean): ZoneDecision {
  if (isZoneHealthy) {
    return { action: 'next' };
  }

  return {
    action: 'outage',
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'retry-after': OUTAGE_RETRY_AFTER_SECONDS,
      'cache-control': 'no-store',
    },
    body: renderZoneErrorHtml(),
  };
}
