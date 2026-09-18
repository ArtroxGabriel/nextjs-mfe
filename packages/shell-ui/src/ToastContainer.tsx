import React, { useState, useEffect } from 'react';
import { MFE_EVENTS, type ToastPayload } from './events';

const AUTO_DISMISS_MS = 4500;

export const ToastContainer = (): React.ReactElement => {
  const [toasts, setToasts] = useState<readonly ToastPayload[]>([]);

  useEffect(() => {
    const activeTimers = new Set<ReturnType<typeof setTimeout>>();

    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastPayload>;
      if (!customEvent.detail) return;

      const toast = customEvent.detail;
      setToasts((prev) => [...prev, toast]);

      const timerId = setTimeout(() => {
        activeTimers.delete(timerId);
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, AUTO_DISMISS_MS);
      activeTimers.add(timerId);
    };

    window.addEventListener(MFE_EVENTS.TOAST, handleToastEvent);
    return () => {
      window.removeEventListener(MFE_EVENTS.TOAST, handleToastEvent);
      activeTimers.forEach((id) => clearTimeout(id));
      activeTimers.clear();
    };
  }, []);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <aside aria-live="polite" className="toast-portal">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card toast-${toast.type}`}>
          <div className="toast-content">
            <strong className="toast-title">{toast.title}</strong>
            <p className="toast-message">{toast.message}</p>
            <time className="toast-time">{new Date(toast.timestamp).toLocaleTimeString()}</time>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => handleDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      ))}
    </aside>
  );
};

export default ToastContainer;
