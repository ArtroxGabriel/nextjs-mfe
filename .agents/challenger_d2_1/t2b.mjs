import { SHELL, sc, get, entrar } from './lib.mjs'
const s = await entrar('bruno')
let r = await get(SHELL + '/zona1', { headers: { cookie: s.cookie, rsc: '1' } })
console.log(r.status, r.headers.get('location'), sc(r))
const t = await (await get(SHELL + '/zona1', { headers: { cookie: s.cookie } })).text()
console.log('flight chunks:', (t.match(/self\.__next_f\.push/g) || []).length)
// busca de dados sensíveis (cpf/custo) em bruno r-1 e api/bff
for (const p of ['/zona1/api/bff/recursos', '/zona1/api/bff/x', '/zona1/api/health', '/api/health']) {
  const x = await get(SHELL + p, { headers: { cookie: s.cookie } }); const b = await x.text()
  console.log(p, x.status, b.slice(0, 160).replace(/\s+/g, ' '), /eyJ|refresh|access_token/.test(b) ? 'ACHADO' : 'limpo')
}
