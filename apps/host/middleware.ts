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

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl?.pathname || '';
  const isZonePath =
    pathname === '/remote-app' ||
    pathname.startsWith('/remote-app/') ||
    pathname.startsWith('/remote-app-static/');

  // Defensive guard: shell routes (including '/') must never be blocked by zone liveness
  if (!isZonePath) {
    return NextResponse.next();
  }

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
