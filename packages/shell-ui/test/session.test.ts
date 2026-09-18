import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-tsx.ts';

type SessionModule = typeof import('../src/session.ts');
let sessionModule: SessionModule;

test.before(async () => {
  sessionModule = await import('../src/session.ts');
});

test('returns DEFAULT_SESSION when cookie header is undefined or empty', () => {
  // Arrange
  const emptyHeader = '';
  const undefinedHeader = undefined;

  // Act
  const sessionFromEmpty = sessionModule.parseSessionFromCookieHeader(emptyHeader);
  const sessionFromUndefined = sessionModule.parseSessionFromCookieHeader(undefinedHeader);

  // Assert
  assert.equal(sessionFromEmpty.userId, 'usr_admin_01');
  assert.equal(sessionFromUndefined.userId, 'usr_admin_01');
});

test('extracts matching user session from simple cookie header', () => {
  // Arrange
  const cookieHeader = 'host_user_session=usr_viewer_03';

  // Act
  const session = sessionModule.parseSessionFromCookieHeader(cookieHeader);

  // Assert
  assert.equal(session.userId, 'usr_viewer_03');
  assert.equal(session.userName, 'Mariana Lima (Viewer)');
  assert.equal(session.role, 'viewer');
});

test('extracts matching user session when surrounded by other cookies', () => {
  // Arrange
  const cookieHeader = 'theme=dark; host_user_session=usr_operator_02; lang=pt-BR';

  // Act
  const session = sessionModule.parseSessionFromCookieHeader(cookieHeader);

  // Assert
  assert.equal(session.userId, 'usr_operator_02');
  assert.equal(session.userName, 'Carlos Silva (Operator)');
  assert.equal(session.role, 'operator');
});

test('extracts user session from json-encoded cookie value', () => {
  // Arrange
  const jsonValue = encodeURIComponent(JSON.stringify({ userId: 'usr_viewer_03' }));
  const cookieHeader = `host_user_session=${jsonValue}`;

  // Act
  const session = sessionModule.parseSessionFromCookieHeader(cookieHeader);

  // Assert
  assert.equal(session.userId, 'usr_viewer_03');
  assert.equal(session.role, 'viewer');
});

test('falls back to DEFAULT_SESSION on unknown userId in cookie', () => {
  // Arrange
  const cookieHeader = 'host_user_session=usr_non_existent';

  // Act
  const session = sessionModule.parseSessionFromCookieHeader(cookieHeader);

  // Assert
  assert.equal(session.userId, 'usr_admin_01');
  assert.equal(session.userName, 'Ana Souza (Admin)');
});

test('writeSessionCookie sets document cookie with userId and path root', () => {
  // Arrange
  const targetUser = {
    userId: 'usr_viewer_03',
    userName: 'Mariana Lima (Viewer)',
    email: 'mariana.lima@guest.io',
    role: 'viewer' as const,
    tenant: 'tenant-public-demo',
  };
  const fakeDoc = { cookie: '' };
  const savedDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = fakeDoc;

  try {
    // Act
    sessionModule.writeSessionCookie(targetUser);

    // Assert
    assert.match(fakeDoc.cookie, /^host_user_session=usr_viewer_03;/);
    assert.match(fakeDoc.cookie, /path=\//);
    assert.match(fakeDoc.cookie, /SameSite=Lax/);
  } finally {
    (globalThis as { document?: unknown }).document = savedDoc;
  }
});

test('writeSessionCookie does not throw when document is undefined', () => {
  // Arrange
  const targetUser = {
    userId: 'usr_viewer_03',
    userName: 'Mariana Lima (Viewer)',
    email: 'mariana.lima@guest.io',
    role: 'viewer' as const,
    tenant: 'tenant-public-demo',
  };
  const savedDoc = (globalThis as { document?: unknown }).document;
  delete (globalThis as { document?: unknown }).document;

  try {
    // Act & Assert
    assert.doesNotThrow(() => {
      sessionModule.writeSessionCookie(targetUser);
    });
  } finally {
    (globalThis as { document?: unknown }).document = savedDoc;
  }
});
