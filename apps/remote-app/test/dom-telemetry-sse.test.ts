import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';
import { setupDomEnvironment } from './support/dom-environment.ts';

type TelemetryModule = typeof import('../components/RemoteTelemetry.tsx');
type ShellModule = typeof import('@mfe/shell-ui');
type SseUrlModule = typeof import('../lib/sseUrl.ts');
type ReactModule = typeof import('react');
type ReactDomClientModule = typeof import('react-dom/client');

let RemoteTelemetry: TelemetryModule['default'];
let shell: ShellModule;
let sseUrlModule: SseUrlModule;
let React: ReactModule;
let ReactDOMClient: ReactDomClientModule;

test.before(async () => {
  RemoteTelemetry = (await import('../components/RemoteTelemetry.tsx')).default;
  shell = await import('@mfe/shell-ui');
  sseUrlModule = await import('../lib/sseUrl.ts');
  React = await import('react');
  ReactDOMClient = await import('react-dom/client');
});

class MockEventSource {
  static instances: MockEventSource[] = [];
  readonly url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  simulateOpen(event = new Event('open')) {
    this.onopen?.(event);
  }

  simulateMessage(data: unknown) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    const event = new MessageEvent('message', { data: raw });
    this.onmessage?.(event);
  }

  simulateError(event = new Event('error')) {
    this.onerror?.(event);
  }
}

test('RemoteTelemetry instantiates EventSource with zone path and manages stream lifecycle', async () => {
  MockEventSource.instances = [];
  const dom = setupDomEnvironment();

  // Install mock EventSource on window and global
  (dom.window as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);

  try {
    // Act - mount RemoteTelemetry
    await React.act(async () => {
      root.render(
        React.createElement(RemoteTelemetry, {
          session: shell.DEFAULT_SESSION,
        })
      );
    });

    // Assert: EventSource created with exact SSE_EVENTS_PATH
    assert.equal(MockEventSource.instances.length, 1);
    const es = MockEventSource.instances[0]!;
    assert.equal(es.url, sseUrlModule.SSE_EVENTS_PATH);
    assert.equal(es.url, '/remote-app/api/sse-events');

    // Assert: status starts as CONNECTING
    const statusEl = container.querySelector('.status-indicator');
    assert.ok(statusEl);
    assert.match(statusEl.textContent || '', /CONNECTING/);

    // Act - simulate open
    await React.act(async () => {
      es.simulateOpen();
    });
    assert.match(statusEl.textContent || '', /CONNECTED/);

    // Act - simulate normal message
    await React.act(async () => {
      es.simulateMessage({
        id: 'evt_001',
        timestamp: new Date().toISOString(),
        level: 'info',
        source: 'telemetry-stream',
        message: 'System operating normally in zone 2',
        value: 10,
      });
    });

    // Assert: message rendered in DOM
    const row = container.querySelector('.event-row.event-info');
    assert.ok(row, 'event row should be rendered');
    assert.match(row.textContent || '', /System operating normally in zone 2/);
    assert.match(row.textContent || '', /telemetry-stream/);

    // Act & Assert: critical event emits mfe:toast on window
    const toastsEmitted: string[] = [];
    const toastListener = (e: unknown) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.title) toastsEmitted.push(detail.title);
    };
    dom.window.addEventListener(shell.MFE_EVENTS.TOAST, toastListener);

    await React.act(async () => {
      es.simulateMessage({
        id: 'evt_crit_99',
        timestamp: new Date().toISOString(),
        level: 'critical',
        source: 'database-circuit',
        message: 'High replication lag detected across zones',
        value: 99,
      });
    });

    dom.window.removeEventListener(shell.MFE_EVENTS.TOAST, toastListener as (event: unknown) => void);

    assert.equal(toastsEmitted.length, 1);
    assert.equal(toastsEmitted[0], 'Critical SSE Alert');
    assert.ok(container.querySelector('.event-row.event-critical'));

    // Act - Pause stream button
    const buttons = Array.from(container.querySelectorAll('.telemetry-controls button')) as HTMLButtonElement[];
    const pauseBtn = buttons.find((b) => b.textContent?.includes('Pause'));
    assert.ok(pauseBtn, 'Pause button should exist');

    await React.act(async () => {
      pauseBtn.click();
    });

    // Assert: connection closed and paused state reflected
    assert.equal(es.closed, true, 'EventSource should be closed on pause');
    assert.match(statusEl.textContent || '', /PAUSED/);
    assert.match(pauseBtn.textContent || '', /Resume/);

    // Act - Clear log button
    const clearBtn = buttons.find((b) => b.textContent?.includes('Clear'));
    assert.ok(clearBtn, 'Clear button should exist');

    await React.act(async () => {
      clearBtn.click();
    });

    assert.equal(container.querySelectorAll('.event-row').length, 0, 'events list should be cleared');

    // Act - Resume stream
    await React.act(async () => {
      pauseBtn.click();
    });

    assert.equal(MockEventSource.instances.length, 2, 'New EventSource should be instantiated on resume');
    const es2 = MockEventSource.instances[1]!;
    assert.equal(es2.closed, false);

    // Act - Simulate error
    await React.act(async () => {
      es2.simulateError();
    });
    assert.match(statusEl.textContent || '', /ERROR/);
  } finally {
    // Unmount must close active EventSource
    await React.act(async () => {
      root.unmount();
    });
    const latestEs = MockEventSource.instances[MockEventSource.instances.length - 1];
    assert.equal(latestEs?.closed, true, 'Unmounting component must close active EventSource');

    dom.cleanup();
  }
});
