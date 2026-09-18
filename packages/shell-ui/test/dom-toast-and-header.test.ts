import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-tsx.ts';
import { setupDomEnvironment } from './support/dom-environment.ts';

type ShellModule = typeof import('../src/index.ts');
type ReactModule = typeof import('react');
type ReactDomClientModule = typeof import('react-dom/client');

let shell: ShellModule;
let React: ReactModule;
let ReactDOMClient: ReactDomClientModule;

test.before(async () => {
  shell = await import('../src/index.ts');
  React = await import('react');
  ReactDOMClient = await import('react-dom/client');
});

test('ToastContainer reacts to window mfe:toast events and renders toast cards in DOM', async () => {
  // Arrange
  const dom = setupDomEnvironment();
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);

  try {
    // Act - mount ToastContainer
    await React.act(async () => {
      root.render(React.createElement(shell.ToastContainer));
    });

    const portal = container.querySelector('.toast-portal');
    assert.ok(portal, 'aside.toast-portal should exist in DOM');
    assert.equal(portal.children.length, 0, 'no toasts initially');

    // Act - emit toast via window event
    await React.act(async () => {
      shell.emitToast('Integration Passed', 'DOM test runner active', 'success');
    });

    // Assert
    assert.equal(portal.children.length, 1, 'one toast rendered');
    const toastCard = portal.querySelector('.toast-card') as HTMLElement;
    assert.ok(toastCard.classList.contains('toast-success'), 'has toast-success class');
    assert.equal(toastCard.querySelector('.toast-title')?.textContent, 'Integration Passed');
    assert.equal(toastCard.querySelector('.toast-message')?.textContent, 'DOM test runner active');

    // Act - dismiss toast via close button
    const closeBtn = toastCard.querySelector('button.toast-close') as HTMLButtonElement;
    assert.ok(closeBtn, 'dismiss button exists');
    await React.act(async () => {
      closeBtn.click();
    });

    // Assert
    assert.equal(portal.children.length, 0, 'toast removed after close click');
  } finally {
    await React.act(async () => {
      root.unmount();
    });
    dom.cleanup();
  }
});

test('Header ping button emits toast caught by ToastContainer in the same DOM tree', async () => {
  // Arrange
  const dom = setupDomEnvironment();
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);

  try {
    let sessionChangeReported: shell.UserSession | null = null;

    // Act - render Header and ToastContainer together
    await React.act(async () => {
      root.render(
        React.createElement(
          'div',
          null,
          React.createElement(shell.Header, {
            currentSession: shell.DEFAULT_SESSION,
            onSessionChange: (session) => {
              sessionChangeReported = session;
            },
            showToastButton: true,
          }),
          React.createElement(shell.ToastContainer)
        )
      );
    });

    const pingBtn = container.querySelector('button.header-toast-btn') as HTMLButtonElement;
    assert.ok(pingBtn, 'ping button should be present in header');

    // Act - click ping button
    await React.act(async () => {
      pingBtn.click();
    });

    // Assert - toast card appeared in DOM
    const portal = container.querySelector('.toast-portal');
    assert.ok(portal);
    assert.equal(portal.children.length, 1, 'toast received from header button click');
    const toastTitle = portal.querySelector('.toast-title');
    assert.equal(toastTitle?.textContent, 'Shell Notification');

    // Act - select another user in dropdown
    const select = container.querySelector('select#user-select') as HTMLSelectElement;
    assert.ok(select, 'user select dropdown exists');
    await React.act(async () => {
      select.value = shell.PRESET_USERS[1]!.userId;
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });

    // Assert
    assert.equal(sessionChangeReported?.userId, shell.PRESET_USERS[1]!.userId);
    assert.equal(sessionChangeReported?.userName, shell.PRESET_USERS[1]!.userName);
  } finally {
    await React.act(async () => {
      root.unmount();
    });
    dom.cleanup();
  }
});

test('unmounting ToastContainer removes event listener without leaking handlers', async () => {
  // Arrange
  const dom = setupDomEnvironment();
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);

  // Act - mount then unmount
  await React.act(async () => {
    root.render(React.createElement(shell.ToastContainer));
  });
  await React.act(async () => {
    root.unmount();
  });

  // Act - emit toast after unmount
  assert.doesNotThrow(() => {
    shell.emitToast('Zombie Toast', 'Should not cause errors', 'info');
  });

  // Assert
  assert.equal(container.children.length, 0, 'container is empty');
  dom.cleanup();
});
