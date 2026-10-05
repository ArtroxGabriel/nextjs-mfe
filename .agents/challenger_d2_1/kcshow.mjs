import { KC } from './lib.mjs'
const adm = (await (await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: 'admin' }) })).json()).access_token
const h = { authorization: 'Bearer ' + adm }
const [c] = await (await fetch(`${KC}/admin/realms/erp/clients?clientId=erp-shell`, { headers: h })).json()
console.log('atributo do cliente:', JSON.stringify(c.attributes?.['access.token.lifespan']), 'chaves:', Object.keys(c.attributes).filter((k) => /lifespan/.test(k)))
const r = await (await fetch(`${KC}/admin/realms/erp`, { headers: h })).json(); console.log('realm accessTokenLifespan:', r.accessTokenLifespan)
