import { GlobalWindow } from 'happy-dom';

export interface DomEnvironment {
  readonly window: InstanceType<typeof GlobalWindow>;
  readonly document: Document;
  readonly cleanup: () => void;
}

const GLOBAL_DOM_PROPERTIES = [
  'window',
  'document',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'CustomEvent',
  'Event',
  'EventTarget',
  'MessageEvent',
  'HTMLElement',
  'HTMLButtonElement',
  'HTMLSelectElement',
  'HTMLDivElement',
  'HTMLInputElement',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const;

/**
 * Creates a clean DOM environment using happy-dom and installs standard
 * browser globals onto globalThis for React 18 client-side rendering.
 */
export function setupDomEnvironment(options: { url?: string } = {}): DomEnvironment {
  const win = new GlobalWindow({ url: options.url ?? 'http://localhost:3001/remote-app' });
  const savedDescriptors = new Map<string, PropertyDescriptor | undefined>();

  for (const prop of GLOBAL_DOM_PROPERTIES) {
    savedDescriptors.set(prop, Object.getOwnPropertyDescriptor(globalThis, prop));
    try {
      Object.defineProperty(globalThis, prop, {
        value: (win as unknown as Record<string, unknown>)[prop],
        configurable: true,
        writable: true,
      });
    } catch {
      // ignore non-configurable
    }
  }

  const prevAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT = true;

  const cleanup = () => {
    for (const prop of GLOBAL_DOM_PROPERTIES) {
      const desc = savedDescriptors.get(prop);
      try {
        if (desc) {
          Object.defineProperty(globalThis, prop, desc);
        } else {
          delete (globalThis as Record<string, unknown>)[prop];
        }
      } catch {
        // ignore
      }
    }
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT = prevAct;
    win.close();
  };

  return {
    window: win,
    document: win.document as unknown as Document,
    cleanup,
  };
}
