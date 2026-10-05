import { KC } from './lib.mjs'
const tok = (await (await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: 'admin' }) })).json()).access_token
const h = { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }
const cfg = await (await fetch(`${KC}/admin/realms/erp/events/config`, { headers: h })).json()
if (process.argv[2] === 'salvar') { (await import('node:fs')).writeFileSync('kcevcfg-original.json', JSON.stringify(cfg)); }
const orig = JSON.parse((await import('node:fs')).readFileSync('kcevcfg-original.json','utf8'))
const novo = process.argv[2] === 'restaurar' ? orig : { ...orig, eventsEnabled: true, enabledEventTypes: [...new Set([...(orig.enabledEventTypes||[]), 'REFRESH_TOKEN','REFRESH_TOKEN_ERROR','CODE_TO_TOKEN','LOGIN'])] }
const r = await fetch(`${KC}/admin/realms/erp/events/config`, { method: 'PUT', headers: h, body: JSON.stringify(novo) })
console.log(process.argv[2], r.status, 'eventsEnabled agora', novo.eventsEnabled)
