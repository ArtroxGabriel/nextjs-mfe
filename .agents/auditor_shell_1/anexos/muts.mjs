// Catálogo de mutações. uso: node muts.mjs <ID>  → aplica na cópia (falha se o trecho não existir)
import { readFileSync, writeFileSync } from 'node:fs'
const C = '/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/e29fcdca-2336-45d2-a30d-626e27eec6b2/scratchpad/repos-copia'
const SH = `${C}/erp-shell`
const D = `${SH}/lib/decisao-proxy.ts`, SZ = `${SH}/lib/saude-zonas.ts`, T = `${SH}/lib/telemetria.ts`
const P = `${SH}/proxy.ts`, RT = `${SH}/app/api/otel/v1/traces/route.ts`, Z = `${SH}/lib/zonas.ts`
const PAGINAS = ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso'].map((a) => `${C}/${a}/lib/pagina.ts`)
const FAILOPEN = `  try {
    if (!(await modulosPermitidos()).some((m) => m.id === id)) notFound()
  } catch (e) {
    if (e instanceof ErroDeAplicacao) return
    throw e
  }`
const M = {
  M1: [[D, 'const saudavel = await cacheSaude.verificar(zona.urlSaude)', 'const saudavel = true']],
  M2: [[D, 'if (!saudavel) {', 'if (saudavel) {']],
  M2b: [[SZ, 'return res.status < 500', 'return res.status >= 500']],
  M3: [[SZ, 'expiraEm: Date.now() + ttlMs', 'expiraEm: Infinity']],
  M3b: [[SZ, 'if (entrada && agora < entrada.expiraEm) {', 'if (entrada) {']],
  M4a: [[D, 'status: 503,', 'status: 500,'], [D, "'retry-after': '5',", '']],
  M4b: [[P, 'return new NextResponse(decisao.html, {', "return new NextResponse('Internal Server Error', { status: 500 })\n      return new NextResponse(decisao.html, {"]],
  M4b2: [[P, 'return new NextResponse(decisao.html, {\n        status: decisao.status,\n        headers: decisao.headers,\n      })', "return new NextResponse('Internal Server Error', { status: 500 })"]],
  M4a2: [[D, 'status: 503,', 'status: 500 as 503,'], [D, "'retry-after': '5',", "'retry-after': undefined as unknown as string,"]],
  M4c: [[P, 'headers: decisao.headers,', 'headers: {},']],
  M5: [[D, "'cache-control': 'no-store',", '']],
  M5b: [[P, 'headers: decisao.headers,', "headers: { ...decisao.headers, 'cache-control': 'public, max-age=3600' },"]],
  M6a: [[T, 'if (!contexto.sessaoValida) {', 'if (false) {']],
  M6b: [[RT, 'sessaoValida: Boolean(sessao),', 'sessaoValida: true,']],
  M7a: [[T, 'if (contexto.tamanhoBytes > TAMANHO_MAXIMO_BYTES) {', 'if (false) {']],
  M7b: [[RT, 'tamanhoBytes = corpo.byteLength', 'tamanhoBytes = 0'], [RT, 'let tamanhoBytes = tamanhoCabecalho ? Number(tamanhoCabecalho) : 0', 'let tamanhoBytes = 0']],
  M8a: [[T, 'if (!limitador.consumir(chave)) {', 'if (false) {']],
  M8b: [[RT, "import {\n  TAMANHO_MAXIMO_BYTES,", "import {\n  LimitadorDeTaxa,\n  TAMANHO_MAXIMO_BYTES,"], [RT, '    tamanhoBytes,\n  })', '    tamanhoBytes,\n  }, new LimitadorDeTaxa(1e9))']],
  M9: PAGINAS.map((f) => [f, FAILOPEN, '  if (!(await modulosPermitidos()).some((m) => m.id === id)) notFound()']),
  M9b: PAGINAS.map((f) => [f, 'if (!(await modulosPermitidos()).some((m) => m.id === id)) notFound()', 'await modulosPermitidos()']),
  M10: [[P, "  headers.delete('x-erp-flash')\n", '']],
  M11a: [[P, "script-src 'self' 'nonce-${nonce}' 'strict-dynamic'", "script-src 'self' 'strict-dynamic'"]],
  M11b: [[P, "'nonce-${nonce}' 'strict-dynamic'", "'unsafe-inline'"], [P, "style-src 'self' 'nonce-${nonce}'", "style-src 'self' 'unsafe-inline'"]],
  M11c: [[P, "headers.set('x-nonce', nonce)", "headers.set('x-nonce', 'fixo')"]],
  M12: [[Z, "  for (const zona of zonas) {\n    if (normalizado === zona.prefixo", "  const minusculo = normalizado.toLowerCase()\n  for (const zona of zonas) {\n    if (minusculo === zona.prefixo || minusculo.startsWith(`${zona.prefixo}/`) || minusculo === zona.prefixoEstatico || minusculo.startsWith(`${zona.prefixoEstatico}/`)) return zona\n    if (normalizado === zona.prefixo"]],
  M13: [[D, '    const saudavel = await cacheSaude.verificar(zona.urlSaude)', "    if (caminho.startsWith(zona.prefixoEstatico)) return { acao: 'zona-estatica' }\n    const saudavel = await cacheSaude.verificar(zona.urlSaude)"]],
  M14: [[SZ, 'export const TIMEOUT_PROBE_PADRAO_MS = 500', 'export const TIMEOUT_PROBE_PADRAO_MS = 600000']],
  M14b: [[SZ, 'signal: AbortSignal.timeout(timeoutMs),', '']],
  M15: [[SZ, 'return res.status < 500', 'return true']],
  M16: [[P, "    res.cookies.set('__Host-flash', '', { path: '/', maxAge: 0 })\n", '']],
  M17: [[P, "    case 'publico':\n      return aplicarCsp(req, decisao.nonce)", "    case 'publico':\n      return NextResponse.next()"]],
  M18: [[D, "if (caminho.startsWith('/api/otel')) {", "if (caminho.startsWith('/api')) {"]],
  M19: [[D, '    if (!temCookieSessao) {\n      return {\n        acao: \'redirecionar-login\',\n        destino: `/login?de=${encodeURIComponent(caminho)}`,\n      }\n    }\n\n    return { acao: \'prosseguir\', nonce }\n  }\n\n  // 4.', '    return { acao: \'prosseguir\', nonce }\n  }\n\n  // 4.']],
  M20: [[P, "headers.set('x-erp-caminho', req.nextUrl.pathname)", "headers.set('x-erp-caminho', '/')"]],
}
const id = process.argv[2]
if (!M[id]) { console.error('mutação desconhecida', id); process.exit(2) }
for (const [f, de, para] of M[id]) {
  const t = readFileSync(f, 'utf8')
  if (!t.includes(de)) { console.error(`NAO ACHOU em ${f}: ${de.slice(0, 80)}`); process.exit(3) }
  writeFileSync(f, t.split(de).join(para))
}
