// Cenario 2 (Keycloak fora) e 3 (token na janela). uso: node c2.mjs <modo> <config>
//   modo: vencido-stop | vencido-pause | janela-saudavel | janela-pause
import { execFileSync } from 'node:child_process'
import * as L from './lib.mjs'
const [modo, cfg = 'tarefa'] = process.argv.slice(2)
if (cfg === 'tarefa') L.configOidc()
else L.configOidc({ ERP_RENOVACAO_LOCK_S: '15', ERP_DESTINO_TIMEOUT_MS: '5000', ERP_RENOVACAO_ESPERA_MS: null })
const KC = 'erp-showcase-keycloak-1'
const dk = (...a) => execFileSync('docker', a, { stdio: 'pipe' }).toString().trim()
const t00 = Date.now()
const T = () => ((Date.now() - t00) / 1000).toFixed(1) + 's'
const resumo = (rs) => { const ms = rs.map((r) => r.ms); const por = {}; for (const r of rs) { const k = r.status + (r.local ? '->' + r.local.split('?')[0] : ''); por[k] = (por[k] ?? 0) + 1 } return { n: rs.length, status: por, p50: Math.round(L.pct(ms, 50)), max: Math.round(Math.max(...ms)), min: Math.round(Math.min(...ms)) } }
await L.vidaDoToken('20')
const amb = await L.subir({ log: true })
let restaurar = null
try {
  await L.esperar(2000)
  const { cookie, id } = await L.entrarPeloKeycloak('ana')
  const s0 = await L.sessaoNoRedis(id)
  L.dizer(`[${T()}] login ok; sessao no Redis; cfg=${cfg} modo=${modo}`)
  const n = 10
  const caminhos = (i) => (i % 2 ? '/zona1' : '/')
  const ready = async (ms = 90000) => { const f = Date.now() + ms; while (Date.now() < f) { if (await L.keycloakNoAr?.()) return true; try { const r = await fetch(`${L.KEYCLOAK_EMISSOR}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(1500) }); if (r.ok) return true } catch {} await L.esperar(1000) } return false }
  const derrubar = () => modo.endsWith('stop') ? dk('stop', KC) : dk('pause', KC)
  const subirKc = async () => { if (modo.endsWith('stop')) dk('start', KC); else dk('unpause', KC); return ready() }
  restaurar = subirKc

  if (modo.startsWith('vencido')) {
    if (process.env.AQUECER === '1') { for (const c of ['/', '/zona1', '/']) { const r = await L.cron(c, { cookie }); L.dizer(`[${T()}] aquecimento ${c}: ${r.status} ${Math.round(r.ms)} ms`) } }
    await L.esperar(s0.tokenExpiraEm + 7000 - Date.now())
    L.dizer(`[${T()}] token vencido ha >= 7 s; derrubando Keycloak (${modo})`)
    derrubar()
    const t1 = Date.now()
    const rs = await Promise.all(Array.from({ length: n }, (_, i) => L.cron(caminhos(i), { cookie })))
    L.dizer(`[${T()}] rajada de ${n} com Keycloak fora:`, resumo(rs))
    rs.forEach((r, i) => L.dizer(`  req ${i} ${caminhos(i)} -> ${r.status} ${r.local ?? ''} ${Math.round(r.ms)} ms ${r.status === 200 ? 'h1/trecho=' + (r.html.match(/<h1[^>]*>([^<]*)/)?.[1] ?? '') + ' indisponivel=' + /indispon/i.test(r.html) + ' modulos=' + /Seus módulos/.test(r.html) : ''}`))
    const sx = await L.sessaoNoRedis(id)
    L.dizer(`[${T()}] sessao no Redis depois da rajada: presente=${!!sx} refreshIgual=${sx?.refreshToken === s0.refreshToken} ttl=${await L.ttlDaSessao(id)}s`)
    // enquanto o lock esta preso: requisicoes sequenciais
    for (let i = 0; i < 3; i++) { const r = await L.cron('/zona1', { cookie }); L.dizer(`[${T()}] sequencial ${i} lock preso: ${r.status} ${r.local ?? ''} ${Math.round(r.ms)} ms`) }
    // espera o lock vencer (a partir da 1a rajada) e pede de novo: o novo vencedor tenta o IdP e falha
    const lockS = Number(process.env.ERP_RENOVACAO_LOCK_S)
    await L.esperar(t1 + lockS * 1000 + 500 - Date.now())
    for (let i = 0; i < 2; i++) { const r = await L.cron('/', { cookie }); L.dizer(`[${T()}] depois do lock vencer (Keycloak ainda fora) ${i}: ${r.status} ${r.local ?? ''} ${Math.round(r.ms)} ms`) }
    const sy = await L.sessaoNoRedis(id)
    L.dizer(`[${T()}] sessao no Redis ainda: presente=${!!sy} refreshIgual=${sy?.refreshToken === s0.refreshToken}`)
    // /login com sessao morta? o navegador iria a /login
    const lg = await L.cron('/login', { cookie }); L.dizer(`[${T()}] /login com o cookie: ${lg.status} ${lg.local ?? ''} ${Math.round(lg.ms)} ms`)
    // volta o Keycloak
    const tUp = Date.now(); const pronto = await subirKc(); restaurar = null
    L.dizer(`[${T()}] Keycloak de volta (pronto=${pronto}) em ${((Date.now() - tUp) / 1000).toFixed(1)} s`)
    // sondagem ate 200
    let primeiro200 = null
    for (let i = 0; i < 60; i++) {
      const hash = L.chaveDaSessao(id).split(':').pop()
      const lk = (await L.redisCru(process.env.REDIS_URL, [['PTTL', 'erp:renovacao:' + hash]])).match(/:(-?\d+)/g)?.pop()
      const r = await L.cron('/zona1', { cookie })
      L.dizer(`[${T()}] lockPTTL${lk} sonda ${i}: ${r.status} ${r.local ?? ''} ${Math.round(r.ms)} ms painel=${L.painelOk(r)}`)
      if (L.painelOk(r)) { primeiro200 = (Date.now() - tUp) / 1000; break }
      await L.esperar(500)
    }
    const sz = await L.sessaoNoRedis(id)
    L.dizer(`[${T()}] primeiro 200 completo ${primeiro200 === null ? 'NUNCA' : primeiro200.toFixed(1) + ' s apos o Keycloak responder'}; mesma sessao=${!!sz}; refreshMudou=${sz?.refreshToken !== s0.refreshToken}; tokenValido=${sz?.tokenExpiraEm > Date.now()}`)
  } else {
    // token ainda valido, na janela: falta < JANELA
    const JAN = Number(process.env.ERP_RENOVACAO_JANELA_S) * 1000
    for (let i = 0; i < 3; i++) { await L.cron('/', { cookie }); await L.cron('/zona1', { cookie }) }
    const ctl = await Promise.all(Array.from({ length: 30 }, (_, i) => L.cron(caminhos(i), { cookie })))
    L.dizer(`[${T()}] CONTROLE (token longe da janela, sem renovacao):`, resumo(ctl), 'ordenadas:', ctl.map((r) => Math.round(r.ms)).sort((a, b) => a - b))
    await L.esperar(s0.tokenExpiraEm - JAN * 0.5 - Date.now())
    const resta = s0.tokenExpiraEm - Date.now()
    L.dizer(`[${T()}] token vale por mais ${resta} ms (janela ${JAN} ms)`)
    if (modo === 'janela-pause') { dk('pause', KC) ; L.dizer(`[${T()}] Keycloak pausado`) }
    const mon = await L.monitorarRedis(process.env.REDIS_URL)
    const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => L.cron(caminhos(i), { cookie })))
    const cmds = await mon.parar()
    const fim = Date.now()
    L.dizer(`[${T()}] rajada de 30 na janela (${modo}); lote terminou ${s0.tokenExpiraEm - fim} ms antes do vencimento:`, resumo(rs))
    L.dizer('  latencias ordenadas (ms):', rs.map((r) => Math.round(r.ms)).sort((a, b) => a - b))
    L.dizer('  painel/inicio completos:', rs.filter((r, i) => (i % 2 ? L.painelOk(r) : L.inicioOk(r))).length, 'de 30; SETs da sessao:', cmds.filter((l) => l.toLowerCase().includes(`"set" "${L.chaveDaSessao(id)}"`)).length)
    if (modo === 'janela-pause') { dk('unpause', KC); await ready() }
  }
} finally {
  amb.derrubar(); await L.esperar(1500)
  if (restaurar) { try { await restaurar() } catch (e) { console.log('restaurar falhou', e.message) } }
  await L.vidaDoToken('')
  L.dizer('KC final:', dk('ps', '--filter', `name=${KC}`, '--format', '{{.Status}}'))
}
