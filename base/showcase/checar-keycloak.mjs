// Confere o Keycloak do showcase: recusa sem PKCE, recusa de verifier errado e troca certa com a vida
// do token e a inatividade configuradas (ERP_TOKEN_VIDA_S, ERP_SESSAO_INATIVIDADE_S; docs/CONFIGURACAO.md).
// Uso: node base/showcase/checar-keycloak.mjs (com o compose no ar). Sai com 1 se algo falhar.
import { createHash, randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'

const VIDA_TOKEN_S = Number(process.env.ERP_TOKEN_VIDA_S ?? 300)
const INATIVIDADE_S = Number(process.env.ERP_SESSAO_INATIVIDADE_S ?? 1800)
const KC = 'http://127.0.0.1:8080/realms/erp/protocol/openid-connect'
const RED = 'http://localhost:3000/api/auth/retorno'
const b64 = (b) => b.toString('base64url')
const autorizar = (extra) =>
  `${KC}/auth?client_id=erp-shell&response_type=code&scope=openid&redirect_uri=${encodeURIComponent(RED)}&state=s1${extra}`

/** Login de um ator pelo formulário do Keycloak; devolve o código e o verifier usado no desafio. */
async function entrar(usuario) {
  const jar = new Map()
  const guardar = (r) => { for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
  const verifier = b64(randomBytes(32))
  const challenge = b64(createHash('sha256').update(verifier).digest())
  let r = await fetch(autorizar(`&code_challenge=${challenge}&code_challenge_method=S256`), { redirect: 'manual' })
  guardar(r)
  const action = (await r.text()).match(/action="([^"]+)"/)[1].replaceAll('&amp;', '&')
  r = await fetch(action, {
    method: 'POST', redirect: 'manual',
    headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: usuario, password: usuario }),
  })
  const loc = new URL(r.headers.get('location'))
  assert.equal(loc.origin + loc.pathname, RED)
  return { code: loc.searchParams.get('code'), verifier }
}

const trocar = (code, verifier) => fetch(`${KC}/token`, {
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
    authorization: 'Basic ' + Buffer.from('erp-shell:dev-erp-shell-segredo').toString('base64'),
  },
  body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: RED, code_verifier: verifier }),
})

const semPkce = await fetch(autorizar(''), { redirect: 'manual' })
assert.match(semPkce.headers.get('location') ?? '', /error=invalid_request/)
console.log('sem PKCE: recusado')

const errado = await entrar('ana')
const r1 = await trocar(errado.code, b64(randomBytes(32)))
assert.equal(r1.status, 400)
console.log('verifier errado: recusado,', (await r1.json()).error)

const certo = await entrar('ana')
const r2 = await trocar(certo.code, certo.verifier)
const j = await r2.json()
assert.equal(r2.status, 200)
const claims = JSON.parse(Buffer.from(j.access_token.split('.')[1], 'base64url'))
assert.equal(claims.preferred_username, 'ana')
assert.equal(claims.exp - claims.iat, VIDA_TOKEN_S)
assert.ok(j.refresh_token)
// sessão por inatividade: o refresh token vale o tempo de inatividade e se renova a cada uso
assert.equal(j.refresh_expires_in, INATIVIDADE_S)
console.log(`verifier certo: token da ana, ${VIDA_TOKEN_S} s; refresh vale ${INATIVIDADE_S} s de inatividade`)
