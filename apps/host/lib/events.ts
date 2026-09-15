import { hostLog } from './logger';
import { MFE_EVENTS } from '@mfe/shell-ui';

export interface ToastPayload {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly type: 'info' | 'success' | 'warning' | 'error';
  readonly timestamp: number;
}

// The event names are the contract between every zone and the shell's
// ToastContainer, so they come from the one definition in @mfe/shell-ui.
export { MFE_EVENTS };

export function emitToast(
  title: string,
  message: string,
  type: ToastPayload['type'] = 'info'
): void {
  if (typeof window === 'undefined') return;

  const payload: ToastPayload = {
    id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    message,
    type,
    timestamp: Date.now(),
  };

  hostLog.client('DISPATCH_MFE_TOAST', {
    id: payload.id,
    title: payload.title,
    type: payload.type,
  });

  window.dispatchEvent(new CustomEvent(MFE_EVENTS.TOAST, { detail: payload }));
}
