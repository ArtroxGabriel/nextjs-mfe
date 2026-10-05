import { KC } from './lib.mjs'
const tok = (await (await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: 'admin' }) })).json()).access_token
const h = { authorization: 'Bearer ' + tok }
const u = await (await fetch(`${KC}/admin/realms/erp/users?username=${process.argv[2]}&exact=true`, { headers: h })).json()
const e = await (await fetch(`${KC}/admin/realms/erp/events?max=500&user=${u[0].id}`, { headers: h })).json()
console.log(e.map((x) => `${new Date(x.time).toISOString()} ${x.type}`).reverse().join('\n'))
