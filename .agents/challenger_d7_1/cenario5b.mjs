import { subir } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/scripts/ambiente.mjs'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
const amb = await subir({})
try {
  const ck = (await entrar('ana')).cookie
  const med = async (rot) => { const t0 = Date.now(); const r = await fetch(`http://localhost:3000${rot}`, { headers: { cookie: ck }, redirect: 'manual', signal: AbortSignal.timeout(60000) }).catch((e) => ({ status: 'erro ' + e.name })); return `${rot} status=${r.status} ms=${Date.now() - t0}` }
  for (const [rot, dom] of [['/zona1', 'dominio-b'], ['/zona2', 'dominio-c']]) {
    await med(rot); process.kill(-amb.dominios.get(dom).pid, 'SIGSTOP')
    console.log(`${dom} congelado (DESTINO=7000, FRAGMENTO=9000, TETO=10000):`, await med(rot))
    process.kill(-amb.dominios.get(dom).pid, 'SIGCONT'); await new Promise(r => setTimeout(r, 1500))
  }
} finally { for (const n of ['dominio-b','dominio-c']) try { process.kill(-amb.dominios.get(n).pid, 'SIGCONT') } catch {}; amb.derrubar(); await new Promise(r => setTimeout(r, 2000)) }
