import './support/register-next-resolution.ts';
import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { setupDomEnvironment } from './support/dom-environment.ts';
import type { DomEnvironment } from './support/dom-environment.ts';
import {
  ZONE_ERROR_HEADING,
  ZONE_ERROR_MESSAGE,
  ZONE_ERROR_RETRY_HINT,
} from '../lib/zoneErrorContent.ts';

let ErroDeZonaPage: React.ComponentType;

before(async () => {
  const mod = await import('../pages/erro-de-zona.tsx');
  ErroDeZonaPage = mod.default;
});

describe('DOM: ErroDeZonaPage (Client Outage Shell - D9 Regression)', () => {
  let dom: DomEnvironment;
  let container: HTMLDivElement;
  let root: Root;
  const networkCalls: string[] = [];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    dom = setupDomEnvironment();
    networkCalls.length = 0;

    const spyFetch = async (input: RequestInfo | URL) => {
      networkCalls.push(String(input));
      return new Response('{}', { status: 200 });
    };

    globalThis.fetch = spyFetch as unknown as typeof fetch;
    (dom.window as unknown as { fetch: typeof fetch }).fetch = spyFetch as unknown as typeof fetch;

    container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    dom.cleanup();
    globalThis.fetch = originalFetch;
  });

  it('renders zone outage page with zero network side-effects during mount and render', async () => {
    // Act: Render outage page in DOM
    await act(async () => {
      root.render(React.createElement(ErroDeZonaPage));
    });

    // Assert: D9 requirement - zero network calls triggered
    assert.equal(
      networkCalls.length,
      0,
      `Outage page must have zero network side-effects, but called: ${networkCalls.join(', ')}`
    );

    // Assert: Outage copy rendered correctly
    const heading = container.querySelector('h2');
    assert.equal(heading?.textContent, ZONE_ERROR_HEADING);

    const paragraphs = Array.from(container.querySelectorAll('p.status-text'));
    assert.ok(
      paragraphs.some((p) => p.textContent?.includes(ZONE_ERROR_MESSAGE)),
      'Should display primary zone outage message'
    );
    assert.ok(
      paragraphs.some((p) => p.textContent?.includes(ZONE_ERROR_RETRY_HINT)),
      'Should display retry guidance'
    );

    // Assert: Navigation fallback actions
    const retryLink = container.querySelector<HTMLAnchorElement>('a.action-btn');
    assert.ok(retryLink);
    assert.equal(retryLink.getAttribute('href'), '/remote-app');

    const shellLink = container.querySelector<HTMLAnchorElement>('a.secondary-btn');
    assert.ok(shellLink);
    assert.equal(shellLink.getAttribute('href'), '/');

    // Assert: Offline badge is visible
    const badge = container.querySelector('.zone-error-badge');
    assert.ok(badge);
    assert.ok(badge.querySelector('.dot-offline'));
  });
});
