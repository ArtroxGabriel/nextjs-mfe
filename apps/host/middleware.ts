import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSharedZoneLivenessCache } from './lib/zoneLiveness';
import { ZONE_MATCHER_PATHS, decideZoneResponse } from './lib/zoneDecision';

export const config = {
  matcher: [...ZONE_MATCHER_PATHS],
};

export async function middleware(_request: NextRequest): Promise<NextResponse> {
  const liveness = getSharedZoneLivenessCache();
  const isZoneHealthy = await liveness.isHealthy();
  const decision = decideZoneResponse(isZoneHealthy);

  if (decision.action === 'next') {
    return NextResponse.next();
  }

  return new NextResponse(decision.body, {
    status: decision.status,
    headers: decision.headers,
  });
}

