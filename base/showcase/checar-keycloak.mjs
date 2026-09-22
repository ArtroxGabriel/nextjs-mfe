// Confere o Keycloak do showcase: PKCE obrigatório, verifier errado, troca certa com a vida
// do token e a inatividade configuradas (ERP_TOKEN_VIDA_S, ERP_SESSAO_INATIVIDADE_S; docs/CONFIGURACAO.md).
// Depois, o endurecimento: implícito e senha direta recusados, redirect exato, audiência erp-dominios,
// rotação de refresh token, TLS fora de loopback, RS256, sem escopo total nem CORS, força bruta.
// Uso: node base/showcase/checar-keycloak.mjs (com o compose no ar). Sai com 1 se algo falhar.
import { createHash, randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'

const VIDA_TOKEN_S = Number(process.env.ERP_TOKEN_VIDA_S ?? 300)
const INATIVIDADE_S = Number(process.env.ERP_SESSAO_INATIVIDADE_S ?? 1800)
const RAIZ_KC = 'http://127.0.0.1:8080'
const KC = `${RAIZ_KC}/realms/erp/protocol/openid-connect`
// segredo do cliente e senha do admin vêm do ambiente (docs/CONFIGURACAO.md); o padrão é o do showcase
const SEGREDO = process.env.IDP_CLIENTE_SEGREDO ?? 'dev-erp-shell-segredo'
const ADMIN = { usuario: process.env.KEYCLOAK_ADMIN_USUARIO ?? 'admin', senha: process.env.KEYCLOAK_ADMIN_SENHA ?? 'admin' }
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
    authorization: 'Basic ' + Buffer.from(`erp-shell:${SEGREDO}`).toString('base64'),
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

// --- endurecimento do cliente e do realm ---------------------------------------------------------
// desafio PKCE válido: sem ele o Keycloak recusa por outro motivo e a conferência passaria sem provar nada
const DESAFIO = b64(createHash('sha256').update(b64(randomBytes(32))).digest())
const semImplicito = await fetch(autorizar(`&code_challenge=${DESAFIO}&code_challenge_method=S256`).replace('response_type=code', 'response_type=token'), { redirect: 'manual' })
assert.match(semImplicito.headers.get('location') ?? '', /error=unauthorized_client|error=unsupported_response_type|error=invalid_request/)
console.log('fluxo implícito: recusado')

const outroRetorno = await fetch(autorizar(`&code_challenge=${DESAFIO}&code_challenge_method=S256`).replace(encodeURIComponent(RED), encodeURIComponent('http://localhost:3000/api/auth/retorno-falso')), { redirect: 'manual' })
// aceita, a URL de autorização responde 200 com o formulário; recusada, 400 com o motivo
assert.equal(outroRetorno.status, 400, 'redirect_uri fora da lista foi aceita')
assert.match(await outroRetorno.text(), /redirect_uri/i)
console.log('redirect_uri fora da lista: recusada,', outroRetorno.status)

const senhaDireta = await fetch(`${KC}/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + Buffer.from(`erp-shell:${SEGREDO}`).toString('base64') },
  body: new URLSearchParams({ grant_type: 'password', username: 'ana', password: 'ana', scope: 'openid' }),
})
assert.equal(senhaDireta.status, 400)
console.log('senha direta (password grant): recusada')

assert.ok([].concat(claims.aud).includes('erp-dominios'), `aud sem erp-dominios: ${JSON.stringify(claims.aud)}`)
console.log('audiência dos domínios: presente')

// rotação: o refresh token vale uma vez; reusar o antigo falha
const renovar = (rt) => fetch(`${KC}/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + Buffer.from(`erp-shell:${SEGREDO}`).toString('base64') },
  body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt }),
})
const r3 = await renovar(j.refresh_token)
assert.equal(r3.status, 200)
const r4 = await renovar(j.refresh_token)
assert.equal(r4.status, 400, 'refresh token reusado foi aceito (sem rotação)')
console.log('refresh token reusado: recusado (rotação ligada)')

// configuração do realm pela API de administração
const adm = await (await fetch(`${RAIZ_KC}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: ADMIN.usuario, password: ADMIN.senha }),
})).json()
const realm = await (await fetch(`${RAIZ_KC}/admin/realms/erp`, { headers: { authorization: `Bearer ${adm.access_token}` } })).json()
assert.equal(realm.sslRequired, 'external')
assert.equal(realm.bruteForceProtected, true)
assert.equal(realm.revokeRefreshToken, true)
assert.equal(realm.refreshTokenMaxReuse, 0)
assert.equal(realm.defaultSignatureAlgorithm, 'RS256')
const [cliente] = await (await fetch(`${RAIZ_KC}/admin/realms/erp/clients?clientId=erp-shell`, { headers: { authorization: `Bearer ${adm.access_token}` } })).json()
assert.equal(cliente.fullScopeAllowed, false)
assert.deepEqual(cliente.webOrigins, [])
console.log('realm: TLS fora de loopback, força bruta, rotação, RS256; cliente sem escopo total e sem CORS')

// força bruta: 5 senhas erradas travam o usuário; destrava no fim para não afetar a próxima conferência
const davi = (await (await fetch(`${RAIZ_KC}/admin/realms/erp/users?username=davi&exact=true`, { headers: { authorization: `Bearer ${adm.access_token}` } })).json())[0]
async function tentar(senha) {
  const jar = new Map()
  let r = await fetch(autorizar(`&code_challenge=${DESAFIO}&code_challenge_method=S256`), { redirect: 'manual' })
  for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) }
  const action = (await r.text()).match(/action="([^"]+)"/)[1].replaceAll('&amp;', '&')
  r = await fetch(action, { method: 'POST', redirect: 'manual', headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: 'davi', password: senha }) })
  return r.status === 302
}
try {
  for (let i = 0; i < 5; i++) assert.equal(await tentar('errada'), false)
  assert.equal(await tentar('davi'), false, 'senha certa aceita depois de 5 erros: sem proteção contra força bruta')
  console.log('força bruta: usuário travado depois de 5 erros')
} finally {
  await fetch(`${RAIZ_KC}/admin/realms/erp/attack-detection/brute-force/users/${davi.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${adm.access_token}` } })
}
assert.equal(await tentar('davi'), true)
console.log('força bruta: destravado para as próximas conferências')
