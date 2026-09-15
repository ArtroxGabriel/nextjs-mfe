import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSharedZoneLivenessCache } from './lib/zoneLiveness';
import { decideZoneResponse } from './lib/zoneDecision';

/**
 * Next.js requires `config.matcher` to be a statically-analyzable literal array
 * at compile time so the bundler can generate the routing manifest.
 */
export const config = {
  matcher: ['/remote-app', '/remote-app/:path*', '/remote-app-static/:path*'],
};

// No pathname check here: the matcher and the rewrites test the raw path,
// while `request.nextUrl.pathname` is normalised (`/remote-app/..` is `/`), so
// any check on it lets zone-bound requests skip the liveness probe. The matcher
// alone decides which requests get here.
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
