import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
const ROOT = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe';
const EVID = path.join(ROOT, '.agents/challenger_m2_6');
const PGDIR = path.join(EVID, 'pg');
fs.mkdirSync(PGDIR, { recursive: true });
const APPS = {
  zone: { cwd: path.join(ROOT, 'apps/remote-app'), port: 3001, ready: 'http://localhost:3001/remote-app/api/health', cmd: (a) => [path.join(a.cwd, 'node_modules/.bin/next'), ['start', '-p', '3001']] },
  host: { cwd: path.join(ROOT, 'apps/host'), port: 3000, ready: 'http://localhost:3000/', cmd: (a) => [path.join(a.cwd, 'node_modules/.bin/next'), ['start', '-p', '3000']] },
  stub: { cwd: EVID, port: 3001, ready: 'http://localhost:3001/__events', cmd: (a, mode) => [process.execPath, [path.join(EVID, 'oracle-stub.mjs'), mode || 'sick']] },
};
export function portOpen(port) {
  return new Promise((resolve) => { const s = net.connect({ port, host: '127.0.0.1' }); s.once('connect', () => { s.destroy(); resolve(true); }); s.once('error', () => resolve(false)); });
}
export async function start(name, { waitReady = true, mode } = {}) {
  const app = APPS[name];
  if (await portOpen(app.port)) throw new Error(`port ${app.port} already open; refusing to start ${name}`);
  const logPath = path.join(EVID, `${name}-${Date.now()}.log`);
  const fd = fs.openSync(logPath, 'a');
  const [bin, args] = app.cmd(app, mode);
  const child = spawn(bin, args, { cwd: app.cwd, detached: true, stdio: ['ignore', fd, fd] });
  child.unref();
  fs.writeFileSync(path.join(PGDIR, name), String(child.pid));
  const t0 = performance.now();
  if (waitReady) for (;;) {
    try { const r = await fetch(app.ready); await r.arrayBuffer(); if (r.status === 200) break; } catch {}
    if (performance.now() - t0 > 60000) throw new Error(`${name} not ready`);
    await new Promise((r) => setTimeout(r, 20));
  }
  return { pgid: child.pid, logPath, readyMs: performance.now() - t0 };
}
export async function stop(name, signal = 'SIGTERM') {
  const f = path.join(PGDIR, name);
  if (!fs.existsSync(f)) return { stopped: false, reason: 'no pgid file' };
  const pgid = Number(fs.readFileSync(f, 'utf8'));
  const tKill = performance.now();
  try { process.kill(-pgid, signal); } catch (e) { fs.unlinkSync(f); return { stopped: false, reason: e.code }; }
  while (await portOpen(APPS[name].port)) await new Promise((r) => setTimeout(r, 5));
  fs.unlinkSync(f);
  return { stopped: true, pgid, signal, portClosedAfterMs: performance.now() - tKill, tKill };
}
export function killNow(name, signal = 'SIGKILL') {
  const f = path.join(PGDIR, name); const pgid = Number(fs.readFileSync(f, 'utf8'));
  const t = performance.now(); process.kill(-pgid, signal); fs.unlinkSync(f); return { pgid, t };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, name, arg] = process.argv.slice(2);
  const out = cmd === 'start' ? await start(name, { mode: arg }) : cmd === 'stop' ? await stop(name, arg) : { error: 'usage' };
  console.log(JSON.stringify({ cmd, name, ...out }));
}
