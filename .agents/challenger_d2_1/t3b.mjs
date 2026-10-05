import { SHELL, get, entrar, redisCmd, sc } from './lib.mjs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const T0 = Date.now(); const t = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(6)
const log = (...a) => console.log(t(), ...a)
const chave = (id) => 'erp:sessao:' + createHash('sha256').update(id).digest('hex')
async function sess(id) { const r = await redisCmd(['GET', chave(id)]); const m = r.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null }
const sh = (x) => x ? createHash('sha256').update(x).digest('hex').slice(0, 8) : '-'
async function resumo(nome, o) { const s = await sess(o.id); if (!s) return log(nome, 'SESSAO AUSENTE NO REDIS'); log(nome, `token vence em ${((s.tokenExpiraEm - Date.now()) / 1000).toFixed(0)}s`, 'refresh#', sh(s.refreshToken), 'sessaoExpiraEm', ((s.expiraEm - Date.now()) / 1000).toFixed(0) + 's') }
async function rajada(nome, s, n, path = '/zona1') {
  const rs = await Promise.all(Array.from({ length: n }, async () => { const a = Date.now(); const r = await get(SHELL + path, { headers: { cookie: s.cookie } }); const b = await r.text(); return { st: r.status, loc: r.headers.get('location'), ms: Date.now() - a, sc: sc(r).map((c) => c.split(';')[0].slice(0, 22)), vaza: /eyJ|refresh_token|stack|at java/.test(b) } }))
  const cont = {}; rs.forEach((r) => { const k = `${r.st}${r.loc ? '->' + r.loc : ''}`; cont[k] = (cont[k] || 0) + 1 })
  const ms = rs.map((r) => r.ms).sort((a, b) => a - b)
  log(`RAJADA ${nome} n=${n} ${path}`, JSON.stringify(cont), `ms p50=${ms[n >> 1]} p95=${ms[Math.floor(n * .95)]} max=${ms[n - 1]}`, 'setcookies:', JSON.stringify([...new Set(rs.flatMap((r) => r.sc))]), rs.some((r) => r.vaza) ? 'VAZAMENTO' : '')
}
const esperarAte = (seg) => new Promise((ok) => setTimeout(ok, Math.max(0, seg * 1000 - (Date.now() - T0))))
const dk = (...a) => execFileSync('docker', a, { encoding: 'utf8' }).trim()
const us = {}; for (const n of ['ana', 'bruno', 'carla', 'davi', 'eva']) us[n] = await entrar(n)
log('5 logins'); 
await esperarAte(72)
// carga pesada, KC no ar: davi e eva, 200 concorrentes, simultâneas
await Promise.all([rajada('davi', us.davi, 200), rajada('eva', us.eva, 200, '/zona2')])
await resumo('davi', us.davi); await resumo('eva', us.eva)
await rajada('davi', us.davi, 200); await resumo('davi', us.davi)
// derruba o KC no meio da janela de ana/bruno
log('docker stop keycloak'); dk('stop', 'erp-showcase-keycloak-1'); log('keycloak parado')
await rajada('ana (KC parado, janela)', us.ana, 30); await resumo('ana', us.ana)
await rajada('ana (de novo, lock preso)', us.ana, 10); await resumo('ana', us.ana)
await esperarAte(100); await rajada('bruno (KC parado, token valido)', us.bruno, 10); await resumo('bruno', us.bruno)
await esperarAte(140); log('--- tokens vencidos, KC parado')
await resumo('ana', us.ana)
await rajada('ana (vencido, KC parado)', us.ana, 20); await resumo('ana', us.ana)
await rajada('carla (vencido, KC parado, nunca renovou)', us.carla, 5); await resumo('carla', us.carla)
const pg = await get(SHELL + '/zona1', { headers: { cookie: us.carla.cookie } }); const body = await pg.text()
log('carla pagina:', pg.status, pg.headers.get('location'), body.slice(0, 120).replace(/\s+/g, ' '))
log('docker start keycloak'); dk('start', 'erp-showcase-keycloak-1')
const fim = Date.now() + 120000
while (Date.now() < fim) { try { const r = await fetch('http://127.0.0.1:8080/realms/erp/.well-known/openid-configuration', { signal: AbortSignal.timeout(2000) }); if (r.ok) break } catch {} await new Promise((r) => setTimeout(r, 1500)) }
log('keycloak voltou')
await rajada('ana (KC de volta)', us.ana, 10); await resumo('ana', us.ana)
await esperarAte(Math.round((Date.now() - T0) / 1000) + 16)   // lock vence
await rajada('ana (apos lock)', us.ana, 10); await resumo('ana', us.ana)
await rajada('carla (apos KC voltar)', us.carla, 10); await resumo('carla', us.carla)
await rajada('bruno', us.bruno, 10); await resumo('bruno', us.bruno)
