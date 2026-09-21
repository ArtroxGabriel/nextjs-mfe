// Sustained load on the targets the pathname guard lets through, zone DOWN. Raw TCP so dot segments are sent as-is.
import net from 'node:net';
import { portOpen } from './pm.mjs';
if (await portOpen(3001)) { console.log('zone UP, abort'); process.exit(2); }
const [dur = '10000', workers = '10'] = process.argv.slice(2);
const T = [['GET', '/remote-app-static'], ['GET', '/remote-app-static?x=1'], ['HEAD', '/remote-app-static'], ['POST', '/remote-app-static'], ['GET', '/remote-app/..'], ['GET', '/remote-app/../REMOTE-APP'], ['GET', '/remote-app'], ['GET', '/']];
const raw = (m, t) => new Promise((res) => { const s = net.connect(3000, '127.0.0.1'); const c = []; s.on('data', (d) => c.push(d)); s.on('error', (e) => res('ERR ' + e.code));
  s.on('close', () => { const b = Buffer.concat(c).toString('latin1'); const i = b.indexOf('\r\n\r\n'); const head = b.slice(0, i).split('\r\n'); const ct = head.find((l) => /^content-type:/i.test(l)); res(`${head[0]?.split(' ')[1]} ct=${ct ? ct.split(':')[1].trim() : null}`); });
  s.write(`${m} ${t} HTTP/1.1\r\nhost: localhost:3000\r\nconnection: close\r\n${m === 'POST' ? 'content-length: 2\r\n\r\n{}' : '\r\n'}`); });
const tally = {}; let i = 0; const t0 = performance.now();
await Promise.all(Array.from({ length: +workers }, async () => { while (performance.now() - t0 < +dur) { const [m, t] = T[i++ % T.length]; const k = `${m} ${t} -> ${await raw(m, t)}`; tally[k] = (tally[k] || 0) + 1; } }));
for (const [k, v] of Object.entries(tally).sort()) console.log(String(v).padStart(6), k);
console.log('elapsed', (performance.now() - t0).toFixed(0), 'ms workers', workers, 'total', Object.values(tally).reduce((a, b) => a + b, 0));
