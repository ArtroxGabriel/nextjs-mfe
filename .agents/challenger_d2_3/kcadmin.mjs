import { KC } from './lib.mjs'
const hdr = async () => ({ authorization: 'Bearer ' + (await (await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: 'admin' }) })).json()).access_token, 'content-type': 'application/json' })
export async function vida(seg) {   // '' restaura
  const [c] = await (await fetch(`${KC}/admin/realms/erp/clients?clientId=erp-shell`, { headers: await hdr() })).json()
  const antes = c.attributes?.['access.token.lifespan']
  const attrs = { ...c.attributes }
  attrs['access.token.lifespan'] = String(seg)
  const r = await fetch(`${KC}/admin/realms/erp/clients/${c.id}`, { method: 'PUT', headers: await hdr(), body: JSON.stringify({ ...c, attributes: attrs }) })
  return { antes, status: r.status }
}
if (process.argv[2]) console.log(await vida(process.argv[2] === 'padrao' ? '' : process.argv[2]))
