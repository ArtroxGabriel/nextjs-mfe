// Catálogo de mutações da iteração 2. uso: node muts.mjs <ID>  → aplica na cópia (falha se o trecho não existir)
import { readFileSync, writeFileSync } from 'node:fs'
const C = '/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/e29fcdca-2336-45d2-a30d-626e27eec6b2/scratchpad/aud2/copia/repos'
const SH = `${C}/erp-shell`
const D = `${SH}/lib/decisao-proxy.ts`, SZ = `${SH}/lib/saude-zonas.ts`, T = `${SH}/lib/telemetria.ts`
const P = `${SH}/proxy.ts`, RT = `${SH}/app/api/otel/v1/traces/route.ts`, Z = `${SH}/lib/zonas.ts`
const pag = (a) => `${C}/${a}/lib/pagina.ts`
const FAILCLOSED = '  if (!(await modulosPermitidos()).some((m) => m.id === id)) notFound()\n}'
// a versão da iteração 1 (a63b995 / bac6d37)
const FAILOPEN = `  try {
    if (!(await modulosPermitidos()).some((m) => m.id === id)) notFound()
  } catch (e) {
    if (e instanceof ErroDeAplicacao) return
    throw e
  }
}`
const failopen = (a) => [[pag(a), FAILCLOSED, FAILOPEN]]
// desvios do N8: cada um acrescenta ao lib/pagina.ts da zona 1 uma função exportada que sai para a rede
const desvio = (codigo) => [[pag('erp-zona-1'), "import 'server-only'\n", `import 'server-only'\n${codigo}\n`]]
const EARLY = '  if (!sessao) return vazia(204)\n'

const M = {
  // 1. exigirModulo fail-open, uma app por vez
  'F1-shell': failopen('erp-shell'),
  'F1-zona1': failopen('erp-zona-1'),
  'F1-zona2': failopen('erp-zona-2'),
  'F1-acesso': failopen('erp-zona-acesso'),
  // 2. caixa
  'C1a': [[Z, "(semQuery.startsWith('/') ? semQuery : `/${semQuery}`).toLowerCase()", "(semQuery.startsWith('/') ? semQuery : `/${semQuery}`)"]],
  'C1b': [[D, 'if (caminho.toLowerCase().startsWith(zona.prefixoEstatico)) {', 'if (caminho.startsWith(zona.prefixoEstatico)) {']],
  // 3. leitura com limite
  'L3a': [[T, "    total += value.byteLength\n    if (total > limite) {\n      await leitor.cancel().catch(() => {})\n      return null\n    }\n    pedacos.push(value)\n  }",
                "    total += value.byteLength\n    pedacos.push(value)\n  }\n  if (total > limite) return null"]],
  'L3b': [[RT, '  if (Number.isFinite(declarado) && declarado > TAMANHO_MAXIMO_BYTES) return vazia(413)\n', '']],
  'L3c': [[RT, 'const corpo = await lerComLimite(req.body, TAMANHO_MAXIMO_BYTES)', 'const corpo = await lerComLimite(req.body, Infinity)']],
  // 4. rota de telemetria
  'T4a': [[RT, EARLY, ''], [RT, '    sessaoValida: true,\n    sub: sessao.sub,', '    sessaoValida: Boolean(sessao),\n    sub: sessao?.sub ?? \'anon\',']],
  'T4a2': [[RT, EARLY, ''], [RT, '    sessaoValida: true,\n    sub: sessao.sub,', '    sessaoValida: true,\n    sub: sessao?.sub ?? \'anon\',']],
  'T4b': [[RT, '  if (resultado.status !== 204) return vazia(resultado.status, resultado.headers)\n', '']],
  'T4b2': [[RT, '  if (resultado.status !== 204) return vazia(resultado.status, resultado.headers)\n', ''],
           [RT, '  return vazia(204)\n}', '  return vazia(resultado.status, resultado.headers)\n}']],
  'T4c': [[RT, 'catch { return vazia(400) }', 'catch { lote = { bruto: new TextDecoder().decode(corpo) } }']],
  // 5. limitador sem limpeza
  'T5': [[T, "    if (this.registros.size >= this.limpezaAcimaDe) {\n      for (const [id, e] of this.registros) {\n        if (agora - e.janelaInicio >= this.janelaMs) this.registros.delete(id)\n      }\n    }\n", '']],
  // 6. CSP
  'CSP6a': [[P, "base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "base-uri 'none'; frame-ancestors 'none'"]],
  'CSP6b': [[P, "img-src 'self' data:; ", '']],
  // 7. desvios do N8 (fetch indireto)
  'N8a': desvio("export const sair1 = () => { const f = globalThis.fetch; return f('http://x') }"),
  'N8b': desvio("export const sair2 = () => (Reflect.get(globalThis, 'fetch') as typeof fetch)('http://x')"),
  'N8c': desvio("export const sair3 = async () => (await import('node:http')).get('http://x')"),
  'N8d': desvio("export const sair4 = () => fetch ('http://x')"),
  'N8e': desvio("export const sair5 = () => fetch.call(null, 'http://x')"),
  'N8f': desvio("export const sair6 = () => { const { fetch: f } = globalThis; return f('http://x') }"),
  'N8g': desvio("export const sair7 = () => (globalThis as any)['fe' + 'tch']('http://x')"),
  'N8h': desvio("import { request as req8 } from 'node:https'\nexport const sair8 = () => req8('https://x')"),
  'N8i': desvio("export const sair9 = () => self.fetch('http://x')"),
  // 8. flash no shell
  'F8a': [[P, "res.cookies.set('__Host-flash', '', { path: '/', maxAge: 0 })", "res.cookies.set('__Host-flash', '', { path: '/', secure: true, sameSite: 'lax', maxAge: 0 })"]],
  'M16': [[P, "  if (flash) {\n    res.cookies.set('__Host-flash', '', { path: '/', maxAge: 0 })\n  }\n", '']],
  // 9. sobreviventes da iteração 1
  'M3': [[SZ, 'expiraEm: Date.now() + ttlMs', 'expiraEm: Infinity']],
  'M3b': [[SZ, 'if (entrada && agora < entrada.expiraEm) {', 'if (entrada) {']],
  'M3c': [[SZ, 'expiraEm: Date.now() + ttlMs', 'expiraEm: Date.now() + (saudavel ? Infinity : ttlMs)']],
  'M3d': [[SZ, 'expiraEm: Date.now() + ttlMs', 'expiraEm: Date.now() + (saudavel ? ttlMs : Infinity)']],
  'M4b2': [[P, 'return new NextResponse(decisao.html, {\n        status: decisao.status,\n        headers: decisao.headers,\n      })', "return new NextResponse('Internal Server Error', { status: 500 })"]],
  'M4c': [[P, 'headers: decisao.headers,', 'headers: {},']],
  'M5b': [[P, 'headers: decisao.headers,', "headers: { ...decisao.headers, 'cache-control': 'public, max-age=3600' },"]],
  'M6a': [[T, 'if (!contexto.sessaoValida) {', 'if (false) {']],
  'M7b': [[RT, 'tamanhoBytes: corpo.byteLength,', 'tamanhoBytes: 0,']],
  'M8b': [[RT, "import {\n  TAMANHO_MAXIMO_BYTES,", "import {\n  LimitadorDeTaxa,\n  TAMANHO_MAXIMO_BYTES,"], [RT, '    tamanhoBytes: corpo.byteLength,\n  })', '    tamanhoBytes: corpo.byteLength,\n  }, new LimitadorDeTaxa(1e9))']],
  'M10': [[P, "  headers.delete('x-erp-flash')\n", '']],
  'M11c': [[P, "headers.set('x-nonce', nonce)", "headers.set('x-nonce', 'fixo')"]],
  'M13': [[D, '    const saudavel = await cacheSaude.verificar(zona.urlSaude)', "    if (caminho.toLowerCase().startsWith(zona.prefixoEstatico)) return { acao: 'zona-estatica' }\n    const saudavel = await cacheSaude.verificar(zona.urlSaude)"]],
  'M14': [[SZ, 'export const TIMEOUT_PROBE_PADRAO_MS = 500', 'export const TIMEOUT_PROBE_PADRAO_MS = 600000']],
  'M14b': [[SZ, 'signal: AbortSignal.timeout(timeoutMs),', '']],
  'M15': [[SZ, 'return res.status < 500', 'return true']],
  'M17': [[P, "    case 'publico':\n      return aplicarCsp(req, decisao.nonce)", "    case 'publico':\n      return NextResponse.next()"]],
  'M18': [[D, "if (caminho.startsWith('/api/otel')) {", "if (caminho.startsWith('/api')) {"]],
  'M20': [[P, "headers.set('x-erp-caminho', req.nextUrl.pathname)", "headers.set('x-erp-caminho', '/')"]],
}
const id = process.argv[2]
if (id === '--lista') { console.log(Object.keys(M).join(' ')); process.exit(0) }
if (!M[id]) { console.error('mutação desconhecida', id); process.exit(2) }
for (const [f, de, para] of M[id]) {
  const t = readFileSync(f, 'utf8')
  if (!t.includes(de)) { console.error(`NAO ACHOU em ${f}: ${de.slice(0, 80)}`); process.exit(3) }
  writeFileSync(f, t.split(de).join(para))
}
