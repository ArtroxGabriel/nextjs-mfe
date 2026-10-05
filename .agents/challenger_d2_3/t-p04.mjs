import { SHELL, KC, get, entrar, redisCmd } from './lib.mjs'
import { createHash } from 'node:crypto'
const chave = (id) => 'erp:sessao:' + createHash('sha256').update(id).digest('hex')
async function sess(id) { const r = await redisCmd(['GET', chave(id)]); const m = r.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null }
const sh = (x) => x ? createHash('sha256').update(x).digest('hex').slice(0, 8) : '-'
const tok = (await (await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: 'admin' }) })).json()).access_token
const gt = async () => (await (await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: 'admin' }) })).json()).access_token
const evs = async (user) => { const tok = await gt(); const u = await (await fetch(`${KC}/admin/realms/erp/users?username=${user}&exact=true`, { headers: { authorization: 'Bearer ' + tok } })).json(); const e = await (await fetch(`${KC}/admin/realms/erp/events?max=500&user=${u[0].id}`, { headers: { authorization: 'Bearer ' + tok } })).json(); const c = {}; e.forEach((x) => { c[x.type] = (c[x.type] || 0) + 1 }); return c }
const T0 = Date.now(); const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(0).padStart(4) + 's', ...a)
const ana = await entrar('ana')
let s = await sess(ana.id); log('login; token vence em', ((s.tokenExpiraEm - Date.now()) / 1000).toFixed(0) + 's', 'refresh#', sh(s.refreshToken), 'eventos KC', JSON.stringify(await evs('ana')))
const alvo = s.tokenExpiraEm + 8000
await new Promise((ok) => setTimeout(ok, alvo - Date.now()))
s = await sess(ana.id); log('vencido ha 8s, sem requisicao; refresh#', sh(s.refreshToken), 'access#', sh(s.accessToken))
const r = await get(SHELL + '/', { headers: { cookie: ana.cookie } }); const corpo = await r.text()
log('GET / ->', r.status, 'bytes', corpo.length, 'location', r.headers.get('location'), 'set-cookie', r.headers.getSetCookie().length)
await new Promise((ok) => setTimeout(ok, 1500))
s = await sess(ana.id); log('depois; refresh#', sh(s.refreshToken), 'access#', sh(s.accessToken), 'token vence em', ((s.tokenExpiraEm - Date.now()) / 1000).toFixed(0) + 's', 'eventos KC', JSON.stringify(await evs('ana')))
const r2 = await get(SHELL + '/', { headers: { cookie: ana.cookie } }); await r2.text(); log('2o GET / ->', r2.status, 'eventos KC', JSON.stringify(await evs('ana')))
