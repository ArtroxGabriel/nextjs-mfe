import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';

test('the app emits toasts under the event names the shared ToastContainer listens on', async () => {
  const { MFE_EVENTS: appEvents } = await import('../lib/events.ts');
  const { MFE_EVENTS: shellEvents } = await import('@mfe/shell-ui');

  assert.equal(appEvents, shellEvents, 'lib/events.ts must re-export the shell-ui constant, not a copy');
});

test('emitToast dispatches the payload on window under the shared toast event name', async () => {
  const { emitToast } = await import('../lib/events.ts');
  const { MFE_EVENTS } = await import('@mfe/shell-ui');

  const target = new EventTarget();
  const saved = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = target;
  const received: CustomEvent[] = [];
  const all: string[] = [];
  const originalDispatch = target.dispatchEvent.bind(target);
  target.dispatchEvent = (event: Event) => {
    all.push(event.type);
    return originalDispatch(event);
  };
  try {
    target.addEventListener(MFE_EVENTS.TOAST, (event) => received.push(event as CustomEvent));
    emitToast('Título', 'Mensagem', 'warning');
  } finally {
    (globalThis as { window?: unknown }).window = saved;
  }

  assert.deepEqual(all, [MFE_EVENTS.TOAST]);
  assert.equal(received.length, 1);
  assert.equal(received[0]!.detail.title, 'Título');
  assert.equal(received[0]!.detail.message, 'Mensagem');
  assert.equal(received[0]!.detail.type, 'warning');
});
