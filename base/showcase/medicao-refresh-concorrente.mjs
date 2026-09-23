// Medição 1 (D2): comportamento do Keycloak diante de renovações simultâneas de refresh token.
// Testa se duas requisições concorrentes com o mesmo refresh token:
// 1) resultam em uma bem-sucedida e uma recusada;
// 2) se a recusa da segunda invalida ou preserva a sessão da primeira (userinfo / próxima renovação).
import { createHash, randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'

const RAIZ_KC = 'http://127.0.0.1:8080'
const KC = `${RAIZ_KC}/realms/erp/protocol/openid-connect`
const SEGREDO = process.env.IDP_CLIENTE_SEGREDO ?? 'dev-erp-shell-segredo'
const RED = 'http://localhost:3000/api/auth/retorno'
const b64 = (b) => b.toString('base64url')

const autorizar = (extra) =>
  `${KC}/auth?client_id=erp-shell&response_type=code&scope=openid&redirect_uri=${encodeURIComponent(RED)}&state=s1${extra}`

async function loginAna() {
  const jar = new Map()
  const guardar = (r) => {
    for (const c of r.headers.getSetCookie()) {
      const [kv] = c.split(';')
      const i = kv.indexOf('=')
      jar.set(kv.slice(0, i), kv.slice(i + 1))
    }
  }
  const verifier = b64(randomBytes(32))
  const challenge = b64(createHash('sha256').update(verifier).digest())
  let r = await fetch(autorizar(`&code_challenge=${challenge}&code_challenge_method=S256`), { redirect: 'manual' })
  guardar(r)
  const html = await r.text()
  const action = html.match(/action="([^"]+)"/)[1].replaceAll('&amp;', '&')
  r = await fetch(action, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ username: 'ana', password: 'ana' }),
  })
  const loc = new URL(r.headers.get('location'))
  const code = loc.searchParams.get('code')

  const rToken = await fetch(`${KC}/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: 'Basic ' + Buffer.from(`erp-shell:${SEGREDO}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: RED,
      code_verifier: verifier,
    }),
  })
  assert.equal(rToken.status, 200, 'Login da Ana falhou')
  return rToken.json()
}

function dispararRenovacao(rt) {
  return fetch(`${KC}/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: 'Basic ' + Buffer.from(`erp-shell:${SEGREDO}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: rt,
    }),
  })
}

async function checarUserinfo(token) {
  return fetch(`${KC}/userinfo`, {
    headers: { authorization: `Bearer ${token}` },
  })
}

console.log('--- Medição 1 do D2: Concorrência de Refresh Token no Keycloak ---')
const sessaoInicial = await loginAna()
console.log('1. Login inicial da Ana realizado com sucesso.')
console.log('   Refresh Token obtido:', sessaoInicial.refresh_token.slice(0, 25) + '...')

console.log('2. Disparando 2 renovações rigorosamente simultâneas com o mesmo refresh token...')
const [res1, res2] = await Promise.all([
  dispararRenovacao(sessaoInicial.refresh_token),
  dispararRenovacao(sessaoInicial.refresh_token),
])

const corpo1 = await res1.json()
const corpo2 = await res2.json()

console.log(`   Requisição A: status ${res1.status}, body:`, JSON.stringify(corpo1).slice(0, 100))
console.log(`   Requisição B: status ${res2.status}, body:`, JSON.stringify(corpo2).slice(0, 100))

const sucesso = res1.status === 200 ? corpo1 : (res2.status === 200 ? corpo2 : null)
const falha = res1.status !== 200 ? corpo1 : (res2.status !== 200 ? corpo2 : null)

if (res1.status === 200 && res2.status === 200) {
  console.log('   Resultado: AMBAS as renovações foram aceitas (janela de tolerância permitiu reuso concorrente).')
} else if (sucesso && falha) {
  console.log('   Resultado: Uma requisição teve sucesso (200) e uma foi rejeitada (' + (res1.status !== 200 ? res1.status : res2.status) + ').')
  console.log('   Motivo da rejeição:', falha.error, falha.error_description)

  console.log('3. Verificando se a sessão do usuário sobreviveu após a recusa da segunda requisição...')
  const rUserinfo = await checarUserinfo(sucesso.access_token)
  console.log(`   Userinfo com o novo token de acesso: status ${rUserinfo.status}`)
  if (rUserinfo.status === 200) {
    const dados = await rUserinfo.json()
    console.log('   Userinfo retornado:', dados.preferred_username, dados.sub)
  }

  console.log('4. Testando nova renovação com o refresh token retornado pela requisição vencedora...')
  const rProx = await dispararRenovacao(sucesso.refresh_token)
  console.log(`   Próxima renovação: status ${rProx.status}`)
  if (rProx.status === 200) {
    console.log('   -> SESSÃO PRESERVADA: O Keycloak rejeitou a segunda requisição concorrente, MAS manteve a sessão ativa para o novo par de tokens.')
  } else {
    const errProx = await rProx.json()
    console.log('   -> SESSÃO REVOGADA: O Keycloak tratou a concorrência como reuso indevido e revogou a sessão inteira!', errProx)
  }
} else {
  console.log('   Resultado: Ambas falharam!', corpo1, corpo2)
}
