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

export async function entrar(usuario, de = '/') {
  const r = await pedir('/api/auth/entrar', { metodo: 'POST', corpo: new URLSearchParams({ usuario, de }) })
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
