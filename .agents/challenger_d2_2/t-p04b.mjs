import { SHELL, get, entrar, redisCmd } from './lib.mjs'
import { createHash } from 'node:crypto'
const chave = (id) => 'erp:sessao:' + createHash('sha256').update(id).digest('hex')
async function sess(id) { const r = await redisCmd(['GET', chave(id)]); const m = r.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null }
const sh = (x) => createHash('sha256').update(x).digest('hex').slice(0, 8)
const bruno = await entrar('bruno')
let s = await sess(bruno.id); console.log('login; refresh#', sh(s.refreshToken))
await new Promise((ok) => setTimeout(ok, s.tokenExpiraEm + 8000 - Date.now()))
const rs = await Promise.all(Array.from({ length: 10 }, async () => { const r = await get(SHELL + '/', { headers: { cookie: bruno.cookie } }); await r.text(); return r.status + (r.headers.get('location') ? '->' + r.headers.get('location') : '') }))
console.log('rajada 10 em / com token vencido:', JSON.stringify(rs.reduce((c, x) => (c[x] = (c[x] || 0) + 1, c), {})))
await new Promise((ok) => setTimeout(ok, 1500)); s = await sess(bruno.id); console.log('depois refresh#', sh(s.refreshToken))
