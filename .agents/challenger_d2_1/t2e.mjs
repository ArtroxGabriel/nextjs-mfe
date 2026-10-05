import { SHELL, get, entrar } from './lib.mjs'
const s = await entrar('carla')
const r = await get(`${SHELL}/zona1/relatorios?_rsc`, { headers: { cookie: s.cookie, rsc: '1' } })
const t = await r.text(); console.log(r.status, t.length, /NEXT_HTTP_ERROR_FALLBACK;404|not-found|NEXT_NOT_FOUND/.test(t), t.match(/NEXT_HTTP_ERROR_FALLBACK;404/) ? 'marca 404 no payload' : t.slice(0,200))
const r2 = await get(`${SHELL}/zona1/inexistente?_rsc`, { headers: { cookie: s.cookie, rsc: '1' } }); console.log('inexistente', r2.status, (await r2.text()).length)
