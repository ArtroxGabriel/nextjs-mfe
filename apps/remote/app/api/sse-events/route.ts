import { type NextRequest } from 'next/server';
import { remoteLog } from '@mfe/ui-shell';
import type { TelemetryEvent } from '../../../types';

const SOURCES = ['sensor-alpha', 'gateway-east', 'db-pool', 'auth-worker'] as const;
const LEVELS: readonly TelemetryEvent['level'][] = ['info', 'info', 'warn', 'critical'];

function generateEvent(): TelemetryEvent {
  const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
  const level = LEVELS[Math.floor(Math.random() * LEVELS.length)];
  const value = Math.round((Math.random() * 100 + 20) * 10) / 10;
  const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  return {
    id,
    timestamp: new Date().toISOString(),
    level,
    source,
    message: `${source} telemetry broadcast (load: ${value}%)`,
    value,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  remoteLog.server('SSE_CLIENT_CONNECTED', {
    ip: request.headers.get('x-forwarded-for') || 'local',
  });

  const encoder = new TextEncoder();

  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected ping
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', ts: Date.now() })}\n\n`)
      );

      intervalId = setInterval(() => {
        try {
          const event = generateEvent();
          remoteLog.server('SSE_EVENT_BROADCAST', {
            id: event.id,
            level: event.level,
            source: event.source,
            value: event.value,
          });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          if (intervalId) clearInterval(intervalId);
        }
      }, 1500);
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
      remoteLog.server('SSE_CLIENT_DISCONNECTED', {});
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
