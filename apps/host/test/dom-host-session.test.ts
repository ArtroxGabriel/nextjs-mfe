import './support/register-next-resolution.ts';
import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { setupDomEnvironment } from './support/dom-environment.ts';
import type { DomEnvironment } from './support/dom-environment.ts';
import type { UserSession } from '../lib/session.ts';

let HostHomePage: React.ComponentType<{
  hostRenderTimestamp: string;
  initialSession: UserSession;
  initialRoute: string;
}>;
let sessionModule: typeof import('../lib/session.ts');

before(async () => {
  sessionModule = await import('../lib/session.ts');
  const mod = await import('../pages/index.tsx');
  HostHomePage = mod.default;
});

describe('DOM: HostHomePage Session Coordination', () => {
  let dom: DomEnvironment;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    dom = setupDomEnvironment();
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
  });

  it('reconciles session from localStorage on client mount if newer than SSR initialSession', async () => {
    // Arrange: Pre-populate localStorage with an updated user session
    const targetUser = sessionModule.PRESET_USERS[1];
    dom.window.localStorage.setItem(
      sessionModule.SESSION_STORAGE_KEY,
      JSON.stringify(targetUser)
    );

    // Act: Render with DEFAULT_SESSION as initialSession
    await act(async () => {
      root.render(
        React.createElement(HostHomePage, {
          hostRenderTimestamp: '2026-09-18T10:00:00Z',
          initialSession: sessionModule.DEFAULT_SESSION,
          initialRoute: '/',
        })
      );
    });

    // Assert: Client-side useEffect reconciles to Carlos Silva
    const sessionText = container.textContent;
    assert.ok(
      sessionText?.includes(targetUser.userName),
      `DOM should reflect reconciled session from localStorage, got: ${sessionText}`
    );
  });

  it('updates DOM, localStorage and document.cookie when user switches session from header', async () => {
    const targetUser = sessionModule.PRESET_USERS[1];

    // Arrange: Mount with DEFAULT_SESSION
    await act(async () => {
      root.render(
        React.createElement(HostHomePage, {
          hostRenderTimestamp: '2026-09-18T10:00:00Z',
          initialSession: sessionModule.DEFAULT_SESSION,
          initialRoute: '/',
        })
      );
    });

    // Act: Find session select dropdown and change value
    const select = container.querySelector<HTMLSelectElement>('.session-dropdown');
    assert.ok(select, 'Header should contain session select');

    await act(async () => {
      select.value = targetUser.userId;
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }) as unknown as Event);
    });

    // Assert: DOM reflects newly selected user
    assert.ok(container.textContent?.includes(targetUser.userName));

    // Assert: localStorage received the new session
    const rawStored = dom.window.localStorage.getItem(sessionModule.SESSION_STORAGE_KEY);
    assert.ok(rawStored);
    const parsedStored = JSON.parse(rawStored) as UserSession;
    assert.equal(parsedStored.userId, targetUser.userId);
    assert.equal(parsedStored.userName, targetUser.userName);

    // Assert: document.cookie contains host_user_session
    assert.ok(
      dom.document.cookie.includes(sessionModule.SESSION_COOKIE_NAME),
      `document.cookie should contain ${sessionModule.SESSION_COOKIE_NAME}, got: ${dom.document.cookie}`
    );
  });
});
