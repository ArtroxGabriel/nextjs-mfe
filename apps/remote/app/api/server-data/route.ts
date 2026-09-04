import { type NextRequest, NextResponse } from 'next/server';
import { getServerData } from '../../../lib/getServerData';
import {
  parseSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
  remoteLog,
  type UserSession,
} from '@mfe/ui-shell';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sessionHeader = request.headers.get('x-user-session');
    let session: UserSession | undefined;

    if (sessionHeader) {
      try {
        session = JSON.parse(sessionHeader);
      } catch {
        // Ignore invalid header
      }
    }

    if (!session) {
      const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (cookie) {
        session = parseSessionFromCookieHeader(`${SESSION_COOKIE_NAME}=${cookie}`);
      }
    }

    remoteLog.server('API_SERVER_DATA_REQUEST', {
      user: session?.userName || 'anonymous',
      ip: request.headers.get('x-forwarded-for') || 'local',
    });

    const data = await getServerData(session);

    remoteLog.server('API_SERVER_DATA_RESPONDED', {
      cached: data.cached,
      requestId: data.requestId,
      origin: data.origin,
    });

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'x-user-session, Content-Type',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch server data';
    remoteLog.error('API_SERVER_DATA_ERROR', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
