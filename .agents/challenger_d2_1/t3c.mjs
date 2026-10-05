import { SHELL, get, entrar } from './lib.mjs'
const e = await entrar('eva')
for (const p of ['/zona2', '/zona1', '/']) { const r = await get(SHELL + p, { headers: { cookie: e.cookie } }); console.log('eva', p, r.status, r.headers.get('location')) }
const rs = await Promise.all(Array.from({ length: 50 }, async () => (await get(SHELL + '/zona2', { headers: { cookie: e.cookie } })).status)); console.log('eva /zona2 x50', JSON.stringify(rs.reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {})))
const d = await entrar('ana'); const rs2 = await Promise.all(Array.from({ length: 50 }, async () => (await get(SHELL + '/zona2', { headers: { cookie: d.cookie } })).status)); console.log('ana /zona2 x50', JSON.stringify(rs2.reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {})))
