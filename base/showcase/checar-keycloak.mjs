// Confere o Keycloak do showcase: recusa sem PKCE, login de um ator, recusa de verifier errado e
// troca certa com token de 300 s. Uso: node base/showcase/checar-keycloak.mjs (com o compose no ar).
import { createHash, randomBytes } from 'node:crypto'
const KC = 'http://127.0.0.1:8080/realms/erp/protocol/openid-connect'
const RED = 'http://localhost:3000/api/auth/retorno'
const b64 = (b) => b.toString('base64url')
const jar = new Map()
const guardar = (r) => { for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
const ck = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')

// 1. sem PKCE
let r = await fetch(`${KC}/auth?client_id=erp-shell&response_type=code&scope=openid&redirect_uri=${encodeURIComponent(RED)}&state=s1`, { redirect: 'manual' })
console.log('sem PKCE:', r.status, (r.headers.get('location') ?? '').replace(/.*error=([^&]+).*/, 'error=$1'))

// 2. com PKCE
const verifier = b64(randomBytes(32)); const challenge = b64(createHash('sha256').update(verifier).digest())
r = await fetch(`${KC}/auth?client_id=erp-shell&response_type=code&scope=openid&redirect_uri=${encodeURIComponent(RED)}&state=s2&code_challenge=${challenge}&code_challenge_method=S256`, { redirect: 'manual' })
guardar(r); const html = await r.text()
const action = html.match(/action="([^"]+)"/)[1].replaceAll('&amp;', '&')
r = await fetch(action, { method: 'POST', redirect: 'manual', headers: { cookie: ck(), 'content-type': 'application/x-www-form-urlencoded' }, body: 'username=ana&password=ana' })
const loc = new URL(r.headers.get('location'))
console.log('login:', r.status, loc.origin + loc.pathname, 'state=' + loc.searchParams.get('state'), 'code?', !!loc.searchParams.get('code'))
const troca = (v) => fetch(`${KC}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + Buffer.from('erp-shell:dev-erp-shell-segredo').toString('base64') },
  body: new URLSearchParams({ grant_type: 'authorization_code', code: loc.searchParams.get('code'), redirect_uri: RED, code_verifier: v }) })
r = await troca(b64(randomBytes(32)))
console.log('troca com verifier errado:', r.status, (await r.json()).error)
