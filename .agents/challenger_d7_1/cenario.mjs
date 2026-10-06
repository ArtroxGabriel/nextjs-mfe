// uso: node cenario.mjs  (ERP_ZONA_TETO_MS no ambiente). Sobe a base, congela zona-2, mede.
import { subir } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/scripts/ambiente.mjs'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
const amb = await subir({ construir: process.env.CONSTRUIR === '1', log: false })
const mascara = (s) => String(s).replace(/__Host-session=[^;\s]+/g, '__Host-session=<mascarado>')
try {
  const ana = (await entrar('ana')).cookie
  const med = async (rot, n = 1) => {
    const t0 = Date.now()
    const r = await fetch(`http://localhost:3000${rot}`, { headers: { cookie: ana }, redirect: 'manual', signal: AbortSignal.timeout(60000) }).catch((e) => ({ status: 'erro ' + e.name, text: async () => '' }))
    const corpo = r.text ? (await r.text().catch(() => '')).slice(0, 60) : ''
    return `${rot} status=${r.status} ms=${Date.now() - t0} corpo=${JSON.stringify(corpo)}`
  }
  console.log('antes:', await med('/zona2'))
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 1500)) // deixa o cache de 1 s da sonda vencer? nao: queremos sonda boa
    await med('/zona2')
    amb.congelarApp('erp-zona-2')
    const r = await med('/zona2')
    amb.descongelarApp('erp-zona-2')
    console.log(`congelada #${i + 1}:`, mascara(r))
    await new Promise((r) => setTimeout(r, 1500))
  }
  console.log('depois:', await med('/zona2'))
} finally { amb.derrubar(); await new Promise((r) => setTimeout(r, 1500)) }
