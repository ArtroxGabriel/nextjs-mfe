// Ponta a ponta em modo OIDC (ADR-0013) contra o Keycloak do showcase. Pasta própria e tarefa própria
// (`task verificar:oidc`): `node --test base/verificacao/*.test.mjs` roda os arquivos em paralelo, e duas bases
// disputariam as portas.
//
// O que prova, pelo shell, como o navegador:
// - login por OIDC + PKCE (entrar → formulário do Keycloak → retorno), sessão só com id opaco;
// - nenhum `refresh_token`, `id_token` nem JWT (`eyJ`) no HTML, no payload RSC, no JS nem nos cookies;
// - página de zona ainda 200, com os blocos dos domínios, DEPOIS do vencimento do primeiro access token
//   (os domínios em modo JWT recusam o token vencido: controle no mesmo teste);
// - 20 requisições concorrentes com o token na janela de renovação (conferida no Redis antes do lote): todas 200,
//   o shell grava a sessão uma vez só, com refresh token novo e `tokenExpiraEm` adiante, e a sessão continua viva
//   depois (com rotação e detecção de reuso, uma segunda renovação com o mesmo refresh token a derrubaria);
// - sair: a sessão acaba e o 303 vai ao logout do Keycloak sem token na URL.
//
// Tempos: a vida do access token do cliente `erp-shell` é encurtada no Keycloak pela API de administração
// (`VERIFICAR_OIDC_TOKEN_VIDA_S`, padrão 20) e devolvida ao valor do realm no fim; `ERP_RENOVACAO_JANELA_S` e
// `ERP_RENOVACAO_LOCK_S` (5 s na tarefa) cabem nela. Ver docs/CONFIGURACAO.md §1 e §6.
//
// Fora da tarefa o arquivo pula. Com `VERIFICAR_OIDC_EXIGIR=1` (a tarefa define) o motivo para pular vira falha:
// no gate, verde é rodado, nunca pulado.
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { subir, SHELL, PORTAS_DE_DOMINIO } from '../../scripts/ambiente.mjs'
import { pedir, valorDoCookie, keycloakNoAr, KEYCLOAK_EMISSOR, redisCru, monitorarRedis } from '../apoio.mjs'

const RAIZ_KC = new URL(KEYCLOAK_EMISSOR).origin
const VIDA_S = Number(process.env.VERIFICAR_OIDC_TOKEN_VIDA_S ?? 20)
const JANELA_S = Number(process.env.ERP_RENOVACAO_JANELA_S ?? 60)
const TOLERANCIA_S = Number(process.env.ERP_JWT_TOLERANCIA_S ?? 5)
const ADMIN = { usuario: process.env.KEYCLOAK_ADMIN_USUARIO ?? 'admin', senha: process.env.KEYCLOAK_ADMIN_SENHA ?? 'admin' }
const SEGREDO = process.env.IDP_CLIENTE_SEGREDO ?? 'dev-erp-shell-segredo'
const DOMINIO_A = `http://127.0.0.1:${PORTAS_DE_DOMINIO['dominio-a']}`

const motivoParaPular = await (async () => {
  if (process.env.IDP_EMISSOR !== KEYCLOAK_EMISSOR) return `IDP_EMISSOR tem de ser ${KEYCLOAK_EMISSOR} (use task verificar:oidc)`
  if (process.env.ERP_PERMITIR_HTTP_LOCAL !== '1') return 'ERP_PERMITIR_HTTP_LOCAL=1 ausente (use task verificar:oidc)'
  if (!process.env.REDIS_URL) return 'REDIS_URL ausente: a renovacao e conferida no store (use task verificar:oidc)'
  if (!(await keycloakNoAr())) return 'Keycloak do showcase fora do ar (task showcase:subir)'
  if (!Number.isInteger(VIDA_S) || VIDA_S < 10 || JANELA_S * 2 >= VIDA_S) return 'VERIFICAR_OIDC_TOKEN_VIDA_S >= 10 e ERP_RENOVACAO_JANELA_S < metade dela'
  return false
})()

if (motivoParaPular && process.env.VERIFICAR_OIDC_EXIGIR === '1') {
  test('pre-condicoes do modo OIDC (VERIFICAR_OIDC_EXIGIR=1)', () => assert.fail(`a verificacao OIDC pularia: ${motivoParaPular}`))
}

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))
const SEGREDOS = [/refresh_token/i, /id_token/i, /eyJ[A-Za-z0-9_-]{8,}/, /refreshToken/, /idToken/, /accessToken/]

/** Administração do Keycloak: vida do access token do cliente do shell; devolve a função que restaura. */
async function encurtarVidaDoToken(segundos) {
  // token de administração novo a cada chamada: o do admin-cli vale 60 s, menos que a verificação
  const cabecalhos = async () => {
    const adm = (await (await fetch(`${RAIZ_KC}/realms/master/protocol/openid-connect/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: ADMIN.usuario, password: ADMIN.senha }),
    })).json()).access_token
    return { authorization: `Bearer ${adm}`, 'content-type': 'application/json' }
  }
  const [cliente] = await (await fetch(`${RAIZ_KC}/admin/realms/erp/clients?clientId=erp-shell`, { headers: await cabecalhos() })).json()
  const original = cliente.attributes?.['access.token.lifespan'] ?? ''
  const gravar = async (v) => {
    const r = await fetch(`${RAIZ_KC}/admin/realms/erp/clients/${cliente.id}`, {
      method: 'PUT', headers: await cabecalhos(), body: JSON.stringify({ ...cliente, attributes: { ...cliente.attributes, 'access.token.lifespan': v } }),
    })
    if (r.status !== 204) throw new Error(`Keycloak recusou mudar a vida do token: HTTP ${r.status}`)
  }
  await gravar(String(segundos))
  return () => gravar(original)   // '' tira o atributo: volta a valer a vida do realm
}

/**
 * A sessão como o shell a gravou no Redis. A chave é o prefixo mais o SHA-256 do id do cookie, como em
 * `sessaoRedisDeEscrita` (`erp-nucleo/src/adaptadores/sessao-redis.ts`).
 */
const chaveDaSessao = (id) => `erp:sessao:${createHash('sha256').update(id).digest('hex')}`
async function sessaoNoRedis(id) {
  const r = await redisCru(process.env.REDIS_URL, [['GET', chaveDaSessao(id)]])
  const json = r.match(/\$\d+\r\n(\{.*\})\r\n/s)?.[1]
  assert.ok(json, 'sessao ausente no Redis')
  return JSON.parse(json)
}

/** Formulário de login do Keycloak a partir da URL de autorização; devolve a URL de retorno ao shell. */
async function loginNoKeycloak(urlAutorizacao, usuario) {
  const jar = new Map()
  const guardar = (r) => { for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
  let r = await fetch(urlAutorizacao, { redirect: 'manual' })
  guardar(r)
  const acao = (await r.text()).match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&')
  if (!acao) throw new Error(`Keycloak sem formulario de login (HTTP ${r.status})`)
  r = await fetch(acao, {
    method: 'POST', redirect: 'manual',
    headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: usuario, password: usuario }),
  })
  const local = r.headers.get('location')
  if (r.status !== 302 || !local) throw new Error(`login de ${usuario} no Keycloak recusado (HTTP ${r.status})`)
  return new URL(local)
}

/** Login completo pelo shell, como o navegador: entrar → Keycloak → retorno. */
async function entrarPeloKeycloak(usuario, de = '/') {
  const ini = await pedir(`/api/auth/entrar?${new URLSearchParams({ de })}`)
  const transacao = valorDoCookie(ini.cookies, '__Host-erp-login')
  assert.ok(transacao, `entrar sem cookie de transacao (HTTP ${ini.status})`)
  const autorizacao = new URL(ini.local)
  assert.equal(autorizacao.origin, RAIZ_KC, 'entrar nao mandou ao Keycloak')
  assert.equal(autorizacao.searchParams.get('code_challenge_method'), 'S256')
  for (const p of ['state', 'nonce', 'code_challenge']) assert.ok(autorizacao.searchParams.get(p), `${p} ausente na autorizacao`)
  const retorno = await loginNoKeycloak(autorizacao, usuario)
  assert.equal(retorno.origin + retorno.pathname, `${SHELL}/api/auth/retorno`)
  const r = await pedir(retorno.pathname + retorno.search, { cookie: `__Host-erp-login=${transacao}` })
  const id = valorDoCookie(r.cookies, '__Host-session')
  assert.ok(id, `retorno sem sessao (HTTP ${r.status})`)
  return { cookie: `__Host-session=${id}`, id, resposta: r }
}

/** A página da zona 1 com os blocos dos dois domínios: só sai assim se o access token da sessão vale. */
function painelComDominios(r, contexto) {
  assert.equal(r.status, 200, `${contexto}: HTTP ${r.status}`)
  assert.match(r.html, /Painel da zona 1/, contexto)
  assert.doesNotMatch(r.html, /Indicadores indisponíveis|Recursos indisponíveis/, `${contexto}: domínio recusou o token da sessão`)
}

/** Access token direto do Keycloak (fora do shell), para o controle de vencimento no domínio. */
async function tokenDireto(usuario) {
  const { createHash, randomBytes } = await import('node:crypto')
  const verifier = randomBytes(32).toString('base64url')
  const desafio = createHash('sha256').update(verifier).digest('base64url')
  const retorno = `${SHELL}/api/auth/retorno`
  const busca = new URLSearchParams({ client_id: 'erp-shell', response_type: 'code', scope: 'openid profile', redirect_uri: retorno, state: 's', code_challenge: desafio, code_challenge_method: 'S256' })
  const code = (await loginNoKeycloak(`${KEYCLOAK_EMISSOR}/protocol/openid-connect/auth?${busca}`, usuario)).searchParams.get('code')
  const j = await (await fetch(`${KEYCLOAK_EMISSOR}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + Buffer.from(`erp-shell:${SEGREDO}`).toString('base64') },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: retorno, code_verifier: verifier }),
  })).json()
  if (!j.access_token) throw new Error(`troca de codigo recusada: ${j.error}`)
  return j
}

describe('modo OIDC contra o Keycloak do showcase (ADR-0013)', { skip: motivoParaPular }, () => {
  let ambiente
  let restaurarVida
  before(async () => {
    restaurarVida = await encurtarVidaDoToken(VIDA_S)
    ambiente = await subir({ construir: process.env.CONSTRUIR === 'tudo' ? 'tudo' : process.env.CONSTRUIR === '1' })
  }, { timeout: 600_000 })
  after(async () => {
    ambiente?.derrubar()
    await restaurarVida?.()
  })

  test('sem IDP de desenvolvimento: /login/dev nao existe', async () => {
    assert.equal((await pedir('/login/dev?state=x&nonce=y')).status, 404)
  })

  test('login pelo Keycloak com PKCE: sessao com id opaco, transacao de uso unico, nenhum token no navegador', async () => {
    const ini = await pedir('/api/auth/entrar?de=%2Fzona1')
    const transacao = valorDoCookie(ini.cookies, '__Host-erp-login')
    const retorno = await loginNoKeycloak(new URL(ini.local), 'ana')
    const r = await pedir(retorno.pathname + retorno.search, { cookie: `__Host-erp-login=${transacao}` })
    assert.equal(r.status, 303)
    assert.equal(r.local, '/zona1')
    const id = valorDoCookie(r.cookies, '__Host-session')
    assert.match(id, /^[0-9a-f-]{36}$/)
    for (const c of r.cookies) for (const s of SEGREDOS) assert.doesNotMatch(c, s, `cookie com token: ${c.split('=')[0]}`)
    // a mesma transação (e o mesmo código) não serve duas vezes
    const de_novo = await pedir(retorno.pathname + retorno.search, { cookie: `__Host-erp-login=${transacao}` })
    assert.equal(valorDoCookie(de_novo.cookies, '__Host-session') ?? '', '', 'transacao reaproveitada')
  })

  test('nenhum refresh_token, id_token ou JWT no HTML, no payload RSC nem no JS das paginas', async () => {
    const { cookie } = await entrarPeloKeycloak('bruno')
    const scripts = new Set()
    for (const caminho of ['/', '/zona1', '/zona1/relatorios', '/zona1/recursos/r-1']) {
      const r = await pedir(caminho, { cookie })
      assert.equal(r.status, 200, caminho)
      const rsc = await pedir(caminho, { cookie, cabecalhos: { rsc: '1' } })
      for (const s of SEGREDOS) {
        assert.doesNotMatch(r.html, s, `${caminho}: ${s} no HTML`)
        assert.doesNotMatch(rsc.html, s, `${caminho}: ${s} no RSC`)
      }
      for (const m of r.html.matchAll(/<script[^>]+src="([^"]+)"/g)) scripts.add(m[1].replaceAll('&amp;', '&'))
    }
    assert.ok(scripts.size > 0, 'nenhum script nas paginas')
    for (const src of scripts) {
      const js = await pedir(src, { cookie })
      assert.equal(js.status, 200, src)
      for (const s of [/eyJ[A-Za-z0-9_-]{8,}/, /dev-erp-shell-segredo/]) assert.doesNotMatch(js.html, s, `${src}: ${s}`)
    }
  })

  test('pagina de zona ainda 200, com os dominios, depois do vencimento do primeiro access token', { timeout: 180_000 }, async () => {
    const { cookie, id } = await entrarPeloKeycloak('ana')
    const controle = await tokenDireto('ana')
    assert.ok(controle.expires_in <= VIDA_S, `Keycloak nao encurtou a vida do token: ${controle.expires_in} s`)
    const comControle = () => fetch(`${DOMINIO_A}/v1/recursos`, { headers: { authorization: `Bearer ${controle.access_token}` } })
    assert.equal((await comControle()).status, 200, 'dominio A recusou o access token novo')
    painelComDominios(await pedir('/zona1', { cookie }), 'antes de vencer')

    // passa da vida do token e da tolerância de relógio do domínio
    await esperar((VIDA_S + TOLERANCIA_S + 2) * 1000)
    assert.equal((await comControle()).status, 401, 'controle: o dominio aceitou o access token vencido')
    painelComDominios(await pedir('/zona1', { cookie }), 'depois do vencimento do primeiro token')

    // 20 requisições juntas com o token na janela, ainda válido: o lock deixa uma renovar; o Keycloak, com rotação e
    // detecção de reuso, derrubaria a sessão inteira numa segunda renovação com o mesmo refresh token. O meio da
    // janela sai do `tokenExpiraEm` gravado, não de uma conta de tempo, e é conferido antes do lote.
    const renovada = await sessaoNoRedis(id)
    await esperar(renovada.tokenExpiraEm - JANELA_S * 500 - Date.now())
    const antes = await sessaoNoRedis(id)
    const resta = antes.tokenExpiraEm - Date.now()
    assert.ok(resta > 0 && resta < JANELA_S * 1000, `lote fora da janela: o token vence em ${resta} ms (janela ${JANELA_S * 1000} ms)`)
    const monitor = await monitorarRedis(process.env.REDIS_URL)
    const juntas = await Promise.all(Array.from({ length: 20 }, () => pedir('/zona1', { cookie })))
    const comandos = await monitor.parar()
    juntas.forEach((r, i) => painelComDominios(r, `concorrente ${i}`))
    const gravacoes = comandos.filter((l) => l.toLowerCase().includes(`"set" "${chaveDaSessao(id)}"`))
    assert.equal(gravacoes.length, 1, `o lote gravou a sessao ${gravacoes.length} vez(es): renovacao ausente ou repetida`)
    const depois = await sessaoNoRedis(id)
    assert.notEqual(depois.refreshToken, antes.refreshToken, 'o refresh token nao mudou no lote')
    assert.ok(depois.tokenExpiraEm > antes.tokenExpiraEm, 'tokenExpiraEm nao avancou no lote')
    // e o token dessa rodada vence também: a próxima página obriga uma renovação com o refresh token que ela deixou
    await esperar((VIDA_S + TOLERANCIA_S + 2) * 1000)
    painelComDominios(await pedir('/zona1', { cookie }), 'depois das renovacoes concorrentes (sessao viva no Keycloak)')
    painelComDominios(await pedir('/zona1', { cookie }), 'segunda leitura')
  })

  test('sair: sessao removida, 303 ao logout do Keycloak sem token; a CSP abre form-action so para o IdP', async () => {
    const { cookie } = await entrarPeloKeycloak('carla')
    const pagina = await pedir('/', { cookie })
    assert.match(pagina.csp, new RegExp(`form-action 'self' ${RAIZ_KC.replaceAll('.', '\\.')}(;|$)`))
    const zona = await pedir('/zona1', { cookie })
    assert.match(zona.csp, new RegExp(`form-action 'self' ${RAIZ_KC.replaceAll('.', '\\.')}(;|$)`), 'CSP da zona sem a origem do IdP')
    const r = await pedir('/api/auth/sair', { cookie, metodo: 'POST' })
    assert.equal(r.status, 303)
    const logout = new URL(r.local)
    assert.equal(logout.origin, RAIZ_KC)
    assert.match(logout.pathname, /\/protocol\/openid-connect\/logout$/)
    assert.deepEqual([...logout.searchParams.keys()].sort(), ['client_id', 'post_logout_redirect_uri'])
    for (const s of SEGREDOS) assert.doesNotMatch(r.local, s)
    assert.equal((await pedir('/zona1', { cookie })).status, 307, 'sessao continuou valendo depois de sair')
  })
})
