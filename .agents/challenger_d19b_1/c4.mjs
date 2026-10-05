import * as L from './lib.mjs'
const casos = [
  ['espera=abc', { ERP_RENOVACAO_ESPERA_MS: 'abc' }],
  ['espera>=lock (5000 vs lock 5)', { ERP_RENOVACAO_ESPERA_MS: '5000' }],
  ['lock<=2*timeout (lock 4, timeout 2000)', { ERP_RENOVACAO_LOCK_S: '4' }],
  ['passo>=espera (passo 4000, espera 4000)', { ERP_RENOVACAO_ESPERA_PASSO_MS: '4000' }],
  ['passo<10 (passo 5)', { ERP_RENOVACAO_ESPERA_PASSO_MS: '5' }],
  ['espera=0 com passo 4000 (passo nao comparado)', { ERP_RENOVACAO_ESPERA_MS: '0', ERP_RENOVACAO_ESPERA_PASSO_MS: '4000' }],
  ['janela=60 (vida do token 20 s, conferida por sessao)', { ERP_RENOVACAO_JANELA_S: '60' }],
  ['controle: config valida', {}],
]
const i = Number(process.argv[2])
const [nome, extra] = casos[i]
L.configOidc(extra)
await L.vidaDoToken('20')
const amb = await L.subir({ log: true })
try {
  await L.esperar(1500)
  L.dizer(`=== CASO ${nome} ${JSON.stringify(extra)}`)
  for (const c of ['/login', '/zona1', '/']) { const r = await L.cron(c); L.dizer(`GET ${c} -> ${r.status} ${r.local ?? ''} corpo=${JSON.stringify(r.html.slice(0, 120))}`) }
  if (nome.startsWith('janela') || nome.startsWith('controle')) {
    const { cookie, id } = await L.entrarPeloKeycloak('ana')
    const r = await L.cron('/zona1', { cookie }); L.dizer(`apos login /zona1 -> ${r.status}`)
    const s = await L.sessaoNoRedis(id); L.dizer('tokenVidaMs na sessao:', s.tokenVidaMs, 'janela efetiva esperada metade da vida')
    await L.esperar(11500)
    const r2 = await L.cron('/zona1', { cookie }); L.dizer(`11,5 s depois /zona1 -> ${r2.status} ${r2.local ?? ''}`)
    const s2 = await L.sessaoNoRedis(id); L.dizer('renovou?', s2.refreshToken !== s.refreshToken)
  }
} finally { amb.derrubar(); await L.esperar(1500); await L.vidaDoToken('') }
