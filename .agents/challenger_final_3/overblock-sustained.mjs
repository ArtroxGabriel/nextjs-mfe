// Shell-owned look-alikes under sustained load. Usage: node overblock-sustained.mjs <dur> <workers> <expectZone up|down>
import net from 'node:net';
import fs from 'node:fs';
import { portOpen } from './pm.mjs';
const [dur = '8000', workers = '10'] = process.argv.slice(2);
const zoneUp = await portOpen(3001);
const B = fs.readFileSync('/home/wilson-castro/Documents/projects/mira/nextjs-mfe/apps/host/.next/BUILD_ID', 'utf8').trim();
const T = ['/%72emote-app', '/remote%2dapp', '/remote-app.json', '/remote-app%2f', '/remote-app-static.json', '/remote-app-%73tatic', '/remote-apps', '/remote-app-staticx', '/remote-app.html', `/_next/data/${B}/index.json`, '/'];
const raw = (t) => new Promise((res) => { const s = net.connect(3000, '127.0.0.1'); const c = []; s.on('data', (d) => c.push(d)); s.on('error', (e) => res('ERR ' + e.code));
  s.on('close', () => { const b = Buffer.concat(c).toString('latin1'); const i = b.indexOf('\r\n\r\n'); const head = b.slice(0, i).split('\r\n'); const ct = head.find((l) => /^content-type:/i.test(l)); res(`${head[0]?.split(' ')[1]} ct=${ct ? ct.split(':')[1].trim() : null}`); });
  s.write(`GET ${t} HTTP/1.1\r\nhost: localhost:3000\r\nconnection: close\r\n\r\n`); });
const tally = {}; let i = 0; const t0 = performance.now();
await Promise.all(Array.from({ length: +workers }, async () => { while (performance.now() - t0 < +dur) { const t = T[i++ % T.length]; const k = `${t.replace(B, '<B>')} -> ${await raw(t)}`; tally[k] = (tally[k] || 0) + 1; } }));
console.log('zoneUp', zoneUp);
for (const [k, v] of Object.entries(tally).sort()) console.log(String(v).padStart(6), k);
console.log('elapsed', (performance.now() - t0).toFixed(0), 'total', Object.values(tally).reduce((a, b) => a + b, 0));
