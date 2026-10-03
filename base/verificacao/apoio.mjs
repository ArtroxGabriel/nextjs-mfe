import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SHELL, RAIZ } from '../scripts/ambiente.mjs'

/** Tudo passa pelo shell, como no navegador. Nenhum redirecionamento é seguido sozinho. */
export async function pedir(caminho, { cookie, metodo = 'GET', corpo, origem = SHELL, cabecalhos = {} } = {}) {
  const headers = { ...cabecalhos }
  if (cookie) headers.cookie = cookie
  if (metodo !== 'GET') headers.origin = origem
  const r = await fetch(`${SHELL}${caminho}`, { method: metodo, headers, body: corpo, redirect: 'manual' })
  return {
    status: r.status,
    local: r.headers.get('location'),
    csp: r.headers.get('content-security-policy'),
    cookies: r.headers.getSetCookie(),
    html: await r.text(),
  }
}

export const valorDoCookie = (setCookies, nome) =>
  setCookies.find((c) => c.startsWith(`${nome}=`))?.split(';')[0].slice(nome.length + 1)

/**
 * O login de desenvolvimento como o navegador o faz (ADR-0013): `GET /api/auth/entrar` grava a
 * transação e manda a `/login/dev?state&nonce`; a página devolve ao retorno com o ator escolhido.
 * `resposta` é a do retorno, que grava `__Host-session`.
 */
export async function iniciarLogin(usuario, de = '/') {
  const ini = await pedir(`/api/auth/entrar?${new URLSearchParams({ de })}`)
  const login = valorDoCookie(ini.cookies, '__Host-erp-login')
  if (!login || !ini.local) throw new Error(`entrar nao devolveu transacao (HTTP ${ini.status})`)
  const dev = new URL(ini.local, SHELL)
  const busca = new URLSearchParams({ state: dev.searchParams.get('state') ?? '', nonce: dev.searchParams.get('nonce') ?? '', usuario })
  return pedir(`/api/auth/retorno?${busca}`, { cookie: `__Host-erp-login=${login}` })
}

export async function entrar(usuario, de = '/') {
  const r = await iniciarLogin(usuario, de)
  const id = valorDoCookie(r.cookies, '__Host-session')
  if (!id) throw new Error(`login de ${usuario} nao devolveu cookie (HTTP ${r.status})`)
  return { cookie: `__Host-session=${id}`, id, resposta: r }
}

/** Links do menu da moldura, na ordem, e qual está marcado como atual. */
export function menu(html) {
  const nav = html.match(/<nav[^>]*aria-label="Módulos"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? ''
  const links = [...nav.matchAll(/<a href="([^"]+)"([^>]*)>/g)]
  return {
    hrefs: links.map((m) => m[1]),
    atual: links.filter((m) => m[2].includes('aria-current="page"')).map((m) => m[1]),
  }
}

/** Formulários de Server Action renderizados (melhoria progressiva): campos ocultos, com o id da action. */
export function formularios(html) {
  return [...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)].map((m) => {
    const campos = {}
    for (const i of m[1].matchAll(/<input([^>]*)>/g)) {
      const nome = i[1].match(/name="([^"]*)"/)?.[1]
      if (nome !== undefined) campos[nome] = (i[1].match(/value="([^"]*)"/)?.[1] ?? '').replaceAll('&quot;', '"').replaceAll('&amp;', '&')
    }
    return campos
  })
}

/**
 * Chama a Server Action como o JavaScript do navegador chama: cabeçalho `Next-Action` e
 * argumentos codificados com o `encodeReply` do próprio Next. É o caminho que um usuário com
 * JavaScript usa, e o único que expõe o comportamento de `redirect()` entre zonas.
 */
export async function acaoPeloCliente({ app, arquivo, nome, caminho, campos, cookie, origem = SHELL }) {
  const manifesto = JSON.parse(readFileSync(join(RAIZ, app, '.next/server/server-reference-manifest.json'), 'utf8'))
  const id = Object.entries(manifesto.node).find(([, v]) => v.exportedName === nome && (v.filename === arquivo || v.filename.endsWith('/' + arquivo) || v.filename.endsWith(arquivo)))?.[0]
  if (!id) throw new Error(`action ${arquivo}#${nome} fora do manifesto de ${app}`)
  const exigir = createRequire(join(RAIZ, app, 'package.json'))
  const { encodeReply } = exigir('next/dist/compiled/react-server-dom-webpack/client.edge.js')
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) if (!k.startsWith('$')) fd.append(k, v)
  const r = await fetch(`${SHELL}${caminho}`, {
    method: 'POST', redirect: 'manual', body: await encodeReply([fd]),
    headers: { cookie, ...(origem === null ? {} : { origin: origem }), 'next-action': id, accept: 'text/x-component' },
  })
  return {
    status: r.status,
    redirecionamento: r.headers.get('x-action-redirect'),
    cookies: r.headers.getSetCookie(),
    corpo: await r.text(),
  }
}

/** Keycloak do showcase (`task showcase:subir`); os testes que precisam dele pulam quando está fora. */
export const KEYCLOAK_EMISSOR = 'http://127.0.0.1:8080/realms/erp'
export const keycloakNoAr = () =>
  fetch(`${KEYCLOAK_EMISSOR}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(1_000) }).then((r) => r.ok, () => false)

/**
 * Access token de um ator no Keycloak do showcase: formulário de login, código com PKCE e troca no token
 * endpoint com o cliente do shell, como o shell faz. O retorno ao shell não é seguido (o código fica aqui).
 */
export async function tokenDoKeycloak(usuario, { segredo = process.env.IDP_CLIENTE_SEGREDO ?? 'dev-erp-shell-segredo' } = {}) {
  const { createHash, randomBytes } = await import('node:crypto')
  const oidc = `${KEYCLOAK_EMISSOR}/protocol/openid-connect`
  const retorno = 'http://localhost:3000/api/auth/retorno'
  const verifier = randomBytes(32).toString('base64url')
  const desafio = createHash('sha256').update(verifier).digest('base64url')
  const jar = new Map()
  const guardar = (r) => { for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
  const busca = new URLSearchParams({ client_id: 'erp-shell', response_type: 'code', scope: 'openid profile', redirect_uri: retorno, state: 's', code_challenge: desafio, code_challenge_method: 'S256' })
  let r = await fetch(`${oidc}/auth?${busca}`, { redirect: 'manual' })
  guardar(r)
  const acao = (await r.text()).match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&')
  if (!acao) throw new Error('Keycloak sem formulario de login')
  r = await fetch(acao, {
    method: 'POST', redirect: 'manual',
    headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: usuario, password: usuario }),
  })
  const code = new URL(r.headers.get('location') ?? '', retorno).searchParams.get('code')
  if (!code) throw new Error(`login de ${usuario} no Keycloak sem codigo (HTTP ${r.status})`)
  r = await fetch(`${oidc}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + Buffer.from(`erp-shell:${segredo}`).toString('base64') },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: retorno, code_verifier: verifier }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`troca de codigo recusada: ${j.error}`)
  return j.access_token
}
