import { KC } from './lib.mjs'
const tok = (await (await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: 'admin' }) })).json()).access_token
const h = { authorization: 'Bearer ' + tok }
const cfg = await (await fetch(`${KC}/admin/realms/erp/events/config`, { headers: h })).json()
console.log('eventsEnabled', cfg.eventsEnabled, 'tipos', (cfg.enabledEventTypes || []).length, 'refresh incluido', (cfg.enabledEventTypes||[]).includes('REFRESH_TOKEN'))
const ev = await (await fetch(`${KC}/admin/realms/erp/events?max=200`, { headers: h })).json()
console.log('eventos', Array.isArray(ev) ? ev.length : JSON.stringify(ev).slice(0,100))
const c = {}; (ev||[]).forEach((e) => { c[e.type] = (c[e.type]||0)+1 }); console.log(JSON.stringify(c))
