// Process manager for challenger_m2_5. Only touches processes it spawned (pgid recorded in PGDIR).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const ROOT = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe';
const EVID = path.join(ROOT, '.agents/challenger_m2_5');
const PGDIR = path.join(EVID, 'pg');
fs.mkdirSync(PGDIR, { recursive: true });

const APPS = {
  zone: { cwd: path.join(ROOT, 'apps/remote-app'), port: 3001, ready: 'http://localhost:3001/remote-app/api/health' },
  host: { cwd: path.join(ROOT, 'apps/host'), port: 3000, ready: 'http://localhost:3000/' },
};

export function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

export async function start(name, { waitReady = true } = {}) {
  const app = APPS[name];
  if (await portOpen(app.port)) throw new Error(`port ${app.port} already open; refusing to start ${name}`);
  const logPath = path.join(EVID, `${name}-${Date.now()}.log`);
  const fd = fs.openSync(logPath, 'a');
  const child = spawn(path.join(app.cwd, 'node_modules/.bin/next'), ['start', '-p', String(app.port)], {
    cwd: app.cwd, detached: true, stdio: ['ignore', fd, fd],
  });
  child.unref();
  fs.writeFileSync(path.join(PGDIR, name), String(child.pid));
  const t0 = performance.now();
  if (waitReady) {
    for (;;) {
      try { const r = await fetch(app.ready); await r.arrayBuffer(); if (r.status === 200) break; } catch {}
      if (performance.now() - t0 > 60000) throw new Error(`${name} not ready in 60s`);
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  return { pgid: child.pid, logPath, readyMs: performance.now() - t0 };
}

export async function stop(name, signal = 'SIGKILL') {
  const f = path.join(PGDIR, name);
  if (!fs.existsSync(f)) return { stopped: false, reason: 'no pgid file' };
  const pgid = Number(fs.readFileSync(f, 'utf8'));
  const tKill = performance.now();
  try { process.kill(-pgid, signal); } catch (e) { return { stopped: false, reason: e.code }; }
  const port = APPS[name].port;
  while (await portOpen(port)) await new Promise((r) => setTimeout(r, 5));
  fs.unlinkSync(f);
  return { stopped: true, pgid, signal, portClosedAfterMs: performance.now() - tKill, tKill };
}

// Kill without waiting (for window experiments): returns kill timestamp.
export function killNow(name, signal = 'SIGKILL') {
  const f = path.join(PGDIR, name);
  const pgid = Number(fs.readFileSync(f, 'utf8'));
  const t = performance.now();
  process.kill(-pgid, signal);
  fs.unlinkSync(f);
  return { pgid, t };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, name, sig] = process.argv.slice(2);
  const out = cmd === 'start' ? await start(name) : cmd === 'stop' ? await stop(name, sig) : { error: 'usage' };
  console.log(JSON.stringify({ cmd, name, ...out }));
}
