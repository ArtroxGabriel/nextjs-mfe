import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';

test('the app emits toasts under the event names the shared ToastContainer listens on', async () => {
  const { MFE_EVENTS: appEvents } = await import('../lib/events.ts');
  const { MFE_EVENTS: shellEvents } = await import('@mfe/shell-ui');

  assert.equal(appEvents, shellEvents, 'lib/events.ts must re-export the shell-ui constant, not a copy');
});
