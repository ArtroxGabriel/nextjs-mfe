import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { NextApiRequest, NextApiResponse } from 'next';
import './support/register-next-resolution.ts';

type SseHandler = (req: NextApiRequest, res: NextApiResponse) => void;

let handler: SseHandler;

test.before(async () => {
  const mod = await import('../pages/api/sse-events.ts');
  handler = mod.default;
});

interface MockSocket extends EventEmitter {
  remoteAddress: string;
}

interface MockReq extends EventEmitter {
  method: string;
  socket: MockSocket;
}

interface MockRes extends EventEmitter {
  headers: Record<string, string>;
  written: string[];
  ended: boolean;
  writableEnded: boolean;
  destroyed: boolean;
  setHeader(key: string, val: string): void;
  write(chunk: string): boolean;
  end(): void;
  flushHeaders?: () => void;
}

function createMockReqRes(): { req: MockReq; res: MockRes; socket: MockSocket } {
  const socket = new EventEmitter() as MockSocket;
  socket.remoteAddress = '127.0.0.1';

  const req = new EventEmitter() as MockReq;
  req.method = 'GET';
  req.socket = socket;

  const res = new EventEmitter() as MockRes;
  res.headers = {};
  res.written = [];
  res.ended = false;
  res.writableEnded = false;
  res.destroyed = false;

  res.setHeader = (key: string, val: string) => {
    res.headers[key.toLowerCase()] = val;
  };

  res.write = (chunk: string) => {
    if (res.destroyed || res.writableEnded) {
      throw new Error('Cannot write after response ended or destroyed');
    }
    res.written.push(chunk);
    return true;
  };

  res.end = () => {
    res.ended = true;
    res.writableEnded = true;
  };

  res.flushHeaders = () => {};

  return { req, res, socket };
}

test('sets appropriate SSE headers and sends initial connected handshake', () => {
  // Arrange
  const { req, res } = createMockReqRes();

  // Act
  handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

  // Assert
  assert.equal(res.headers['content-type'], 'text/event-stream');
  assert.equal(res.headers['cache-control'], 'no-cache, no-transform');
  assert.equal(res.headers['connection'], 'keep-alive');
  assert.ok(res.written.length >= 1);
  assert.match(res.written[0]!, /event: connected/);

  // Cleanup
  res.emit('close');
});

test('clears interval and terminates when response stream emits close', () => {
  // Arrange
  const { req, res } = createMockReqRes();
  let clearedIntervalId: NodeJS.Timeout | null = null;
  const originalClearInterval = globalThis.clearInterval;
  globalThis.clearInterval = (id: NodeJS.Timeout | string | number | undefined) => {
    clearedIntervalId = id as NodeJS.Timeout;
    originalClearInterval(id);
  };

  try {
    // Act
    handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
    assert.equal(clearedIntervalId, null, 'interval should be active while connection is open');

    // Simulate client closing the response connection (ServerResponse 'close')
    res.emit('close');

    // Assert
    assert.ok(clearedIntervalId !== null, 'expected clearInterval to be called when res emits close');
    assert.equal(res.ended, true, 'expected response to be ended on disconnect');
  } finally {
    globalThis.clearInterval = originalClearInterval;
  }
});

test('clears interval and terminates when underlying socket emits close', () => {
  // Arrange
  const { req, res, socket } = createMockReqRes();
  let clearedIntervalId: NodeJS.Timeout | null = null;
  const originalClearInterval = globalThis.clearInterval;
  globalThis.clearInterval = (id: NodeJS.Timeout | string | number | undefined) => {
    clearedIntervalId = id as NodeJS.Timeout;
    originalClearInterval(id);
  };

  try {
    // Act
    handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    // Simulate socket disconnecting
    socket.emit('close');

    // Assert
    assert.ok(clearedIntervalId !== null, 'expected clearInterval to be called when socket emits close');
  } finally {
    globalThis.clearInterval = originalClearInterval;
  }
});

test('idempotent cleanup handles multiple close events without error', () => {
  // Arrange
  const { req, res, socket } = createMockReqRes();
  let clearCount = 0;
  const originalClearInterval = globalThis.clearInterval;
  globalThis.clearInterval = (id: NodeJS.Timeout | string | number | undefined) => {
    clearCount++;
    originalClearInterval(id);
  };

  try {
    // Act
    handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
    res.emit('close');
    req.emit('close');
    socket.emit('close');

    // Assert
    assert.equal(clearCount, 1, 'clearInterval should only be invoked once');
  } finally {
    globalThis.clearInterval = originalClearInterval;
  }
});
