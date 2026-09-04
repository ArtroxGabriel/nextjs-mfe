export interface ToastPayload {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly type: 'info' | 'success' | 'warning' | 'error';
  readonly timestamp: number;
}

export interface MapMarker {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly status: 'active' | 'warning' | 'idle';
  readonly description: string;
}

export const MFE_EVENTS = {
  TOAST: 'mfe:toast',
  SESSION_CHANGE: 'mfe:session-change',
  MAP_SELECT: 'mfe:map-select',
} as const;

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

  window.dispatchEvent(new CustomEvent(MFE_EVENTS.TOAST, { detail: payload }));
}

export function emitMapSelect(marker: MapMarker): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MFE_EVENTS.MAP_SELECT, { detail: marker }));
}
