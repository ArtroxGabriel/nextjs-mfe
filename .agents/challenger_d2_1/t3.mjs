import { SHELL, get, entrar, redisCmd, sc } from './lib.mjs'
import { createHash } from 'node:crypto'
const T0 = Date.now(); const t = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(6)
const log = (...a) => console.log(t(), ...a)
const chave = (id) => 'erp:sessao:' + createHash('sha256').update(id).digest('hex')
async function sess(id) { const r = await redisCmd(['GET', chave(id)]); const m = r.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null }
const sh = (x) => x ? createHash('sha256').update(x).digest('hex').slice(0, 8) : '-'
async function resumo(nome, o) { const s = await sess(o.id); if (!s) return log(nome, 'SESSAO AUSENTE'); log(nome, `token vence em ${((s.tokenExpiraEm - Date.now()) / 1000).toFixed(0)}s`, 'refresh#', sh(s.refreshToken), 'access#', sh(s.accessToken), 'sessaoExpiraEm', ((s.expiraEm - Date.now())/1000).toFixed(0)+'s') }
const ana = await entrar('ana'), bruno = await entrar('bruno'), carla = await entrar('carla')
log('logins feitos'); for (const [n, s] of [['ana', ana], ['bruno', bruno], ['carla', carla]]) await resumo(n, s)
async function rajada(nome, s, n, path = '/zona1') {
  const ini = Date.now()
  const rs = await Promise.all(Array.from({ length: n }, async () => { const a = Date.now(); const r = await get(SHELL + path, { headers: { cookie: s.cookie } }); await r.text(); return { st: r.status, loc: r.headers.get('location'), ms: Date.now() - a, sc: sc(r).map((c) => c.split(';')[0].slice(0, 20)) } }))
  const cont = {}; rs.forEach((r) => { const k = `${r.st}${r.loc ? '->' + r.loc : ''}`; cont[k] = (cont[k] || 0) + 1 })
  const ms = rs.map((r) => r.ms).sort((a, b) => a - b)
  log(`RAJADA ${nome} n=${n} ${path}`, JSON.stringify(cont), `ms p50=${ms[n >> 1]} max=${ms[n - 1]}`, 'setcookies:', JSON.stringify([...new Set(rs.flatMap((r) => r.sc))]))
}
const esperarAte = (seg) => new Promise((ok) => setTimeout(ok, Math.max(0, seg * 1000 - (Date.now() - T0))))
// antes da janela
await rajada('ana', ana, 10); await rajada('bruno', bruno, 10)
await esperarAte(66); await resumo('ana', ana)
await esperarAte(72); await resumo('ana(pos 72s)', ana)
await rajada('ana', ana, 30); await resumo('ana', ana)
await rajada('ana', ana, 30); await resumo('ana', ana)
await rajada('bruno', bruno, 30, '/zona1/relatorios'); await resumo('bruno', bruno)
// ana segue com cargas periodicas ate passar do vencimento original (130s) e do 2o
for (const s of [100, 140, 190, 215]) { await esperarAte(s); await rajada('ana', ana, 5); await resumo('ana', ana) }
// carla ficou parada: token vencido (130s) sem nenhuma requisicao
await esperarAte(222); await resumo('carla(parada)', carla)
await rajada('carla(token vencido)', carla, 20); await resumo('carla', carla)
await rajada('carla pos', carla, 5); await resumo('carla', carla)
// bruno tambem ficou sem requisicao desde 100s -> vencido
await rajada('bruno(vencido)', bruno, 5, '/zona1'); await resumo('bruno', bruno)
// validar que a sessao de ana continua valida contra o KC (access token do store em userinfo)
const s = await sess(ana.id)
const u = await fetch('http://127.0.0.1:8080/realms/erp/protocol/openid-connect/userinfo', { headers: { authorization: 'Bearer ' + s.accessToken } })
log('userinfo(ana access token do store):', u.status)
