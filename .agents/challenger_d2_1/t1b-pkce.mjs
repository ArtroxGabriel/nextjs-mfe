import { KC, SEGREDO, sc, get } from './lib.mjs'
import { createHash, randomBytes } from 'node:crypto'
const out = (k, v) => console.log(k.padEnd(44), v)
const b64 = (b) => b.toString('base64url')
async function code(verifier, method = 'S256') {
  const ch = method === 'S256' ? b64(createHash('sha256').update(verifier).digest()) : verifier
  const q = new URLSearchParams({ client_id: 'erp-shell', response_type: 'code', redirect_uri: 'http://localhost:3000/api/auth/retorno', scope: 'openid', state: 's', nonce: 'n', code_challenge: ch, code_challenge_method: method })
  const f = await get(`${KC}/realms/erp/protocol/openid-connect/auth?${q}`)
  const jar = sc(f).map((c) => c.split(';')[0]).join('; ')
  const action = (await f.text()).match(/action="([^"]+)"/)[1].replaceAll('&amp;', '&')
  const p = await get(action, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar }, body: new URLSearchParams({ username: 'ana', password: 'ana' }) })
  return new URL(p.headers.get('location')).searchParams.get('code')
}
const tok = async (c, v) => { const r = await fetch(`${KC}/realms/erp/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'erp-shell', client_secret: SEGREDO, redirect_uri: 'http://localhost:3000/api/auth/retorno', code: c, ...(v ? { code_verifier: v } : {}) }) }); return `${r.status} ${(await r.text()).slice(0, 110)}` }
const v = b64(randomBytes(32))
let c = await code(v)
out('verifier errado', await tok(c, b64(randomBytes(32))))
out('mesmo code depois (verifier certo)', await tok(c, v))
c = await code(v)
out('sem verifier', await tok(c))
c = await code(v)
const ok = await tok(c, v); out('verifier certo (1a vez)', ok.slice(0, 60))
out('code reusado', await tok(c, v))
// plain method
const p = await (async () => { try { return await code(v, 'plain') } catch (e) { return 'ERR ' + e.message.slice(0,60) } })()
out('challenge method plain', String(p).slice(0, 40))
// sem challenge
const f = await get(`${KC}/realms/erp/protocol/openid-connect/auth?client_id=erp-shell&response_type=code&redirect_uri=${encodeURIComponent('http://localhost:3000/api/auth/retorno')}&scope=openid`)
out('auth sem PKCE', `${f.status} ${(f.headers.get('location')||'').slice(0,120)}`)
