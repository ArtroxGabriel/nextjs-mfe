// auditor_shell_4: quantos cabeçalhos CSP chegam em /zona1 e com qual nonce (prova de equivalência de CSP-nonce-fixo-zonas)
import { subir, SHELL } from '../scripts/ambiente.mjs'
import { entrar } from '../verificacao/apoio.mjs'
const a = await subir({ construir: true })
try {
  const { cookie } = await entrar('ana')
  for (const c of ['/zona1', '/zona1', '/zona2']) {
    const r = await fetch(`${SHELL}${c}`, { headers: { cookie }, redirect: 'manual' })
    const brutos = [...r.headers].filter(([k]) => k === 'content-security-policy').map(([, v]) => v)
    const html = await r.text()
    console.log(c, r.status, 'CSP:', JSON.stringify(brutos.map((v) => v.match(/'nonce-([^']+)'/g))), 'x-nonce:', r.headers.get('x-nonce'),
      'nonce nos scripts:', [...new Set([...html.matchAll(/nonce="([^"]+)"/g)].map((m) => m[1]))])
  }
} finally { a.derrubar() }
