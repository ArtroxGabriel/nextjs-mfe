import { subir } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/scripts/ambiente.mjs'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
const amb = await subir({})
try {
  const ck = (await entrar('ana')).cookie
  const med = async (rot, h = {}) => {
    const t0 = Date.now()
    const r = await fetch(`http://localhost:3000${rot}`, { headers: { cookie: ck, ...h }, redirect: 'manual', signal: AbortSignal.timeout(60000) }).catch((e) => ({ status: 'erro ' + e.name, headers: new Headers(), text: async () => '' }))
    const c = (await r.text().catch(() => ''))
    const t = c.match(/<title>([^<]*)/)?.[1]
    return `${rot} status=${r.status} ms=${Date.now() - t0} loc=${r.headers.get('location') ?? ''} retry-after=${r.headers.get('retry-after') ?? ''} title=${JSON.stringify(t ?? c.slice(0, 50))} supportId=${/supportId|suporte/i.test(c)} stack=${/at java|org\.spring|\.mjs:/.test(c)}`
  }
  const grupo = (n) => amb.dominios.get(n).pid
  // 5a: zona congelada; rotas proprias do shell
  await med('/zona2'); amb.congelarApp('erp-zona-2')
  console.log('5a zona2 congelada:'); for (const r of ['/login', '/', '/erro-de-zona', '/zona1']) console.log('  ', await med(r))
  amb.descongelarApp('erp-zona-2'); await new Promise(r => setTimeout(r, 1500))
  // 5b: zona fora do ar (porta fechada)
  await amb.derrubarApp('erp-zona-2'); await new Promise(r => setTimeout(r, 1200))
  console.log('5b zona2 fora do ar (SIGKILL):'); for (let i = 0; i < 2; i++) console.log('  ', await med('/zona2'))
  await amb.subirApp('erp-zona-2'); await new Promise(r => setTimeout(r, 1500))
  console.log('   zona2 de volta:', await med('/zona2'))
  // 5c: dominio lento (congelado) ate ERP_DESTINO_TIMEOUT_MS
  for (const [rot, dom] of [['/zona1', 'dominio-b'], ['/zona2', 'dominio-c']]) {
    await med(rot); process.kill(-grupo(dom), 'SIGSTOP')
    console.log(`5c ${dom} congelado:`, await med(rot), await med(rot))
    process.kill(-grupo(dom), 'SIGCONT'); await new Promise(r => setTimeout(r, 1500))
    console.log('   depois:', await med(rot))
  }
} finally { for (const n of ['dominio-b','dominio-c']) try { process.kill(-amb.dominios.get(n).pid, 'SIGCONT') } catch {}; amb.derrubar(); await new Promise(r => setTimeout(r, 2000)) }
