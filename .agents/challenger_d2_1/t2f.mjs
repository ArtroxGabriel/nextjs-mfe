import { SHELL, get, entrar } from './lib.mjs'
const s = await entrar('carla')
for (const p of ['/zona1/relatorios', '/zona1/inexistente', '/zona1/recursos/r-3', '/zona1/recursos/zzz']) for (const rsc of [false, true]) {
  const r = await get(`${SHELL}${p}${rsc ? '?_rsc' : ''}`, { headers: { cookie: s.cookie, ...(rsc ? { rsc: '1' } : {}) } })
  console.log(p.padEnd(24), rsc ? 'RSC ' : 'HTML', r.status, (await r.text()).length)
}
