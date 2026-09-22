// Catálogo de mutações do auditor_shell_3 (gate "Shell novo", iteração 3).
// uso: node muts.mjs <ID>  → aplica na CÓPIA (falha se o trecho não existir). node muts.mjs --lista
// IDs que começam com "D-" mexem no dist instalado do @erp/nucleo 0.6.0 das apps (node_modules da cópia);
// IDs que começam com "N-" mexem no fonte do erp-nucleo da cópia (suíte: unidade do núcleo).
import { readFileSync, writeFileSync, realpathSync } from 'node:fs'
const C = '/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/09322a0e-689b-4bc7-ad2e-80de22035516/scratchpad/aud3/copia/repos'
const SH = `${C}/erp-shell`
const D = `${SH}/lib/decisao-proxy.ts`, SZ = `${SH}/lib/saude-zonas.ts`, T = `${SH}/lib/telemetria.ts`
const P = `${SH}/proxy.ts`, RT = `${SH}/app/api/otel/v1/traces/route.ts`, Z = `${SH}/lib/zonas.ts`
const REC = `${C}/erp-zona-1/app/zona1/recursos/[id]/page.tsx`
const APPS = ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']
const ZONAS = APPS.slice(1)
const pag = (a) => `${C}/${a}/lib/pagina.ts`
const dist = (a, f) => `${realpathSync(`${C}/${a}/node_modules/@erp/nucleo`)}/dist/${f}`
const NS = (f) => `${C}/erp-nucleo/src/${f}`

// exigirModulo: versão da iteração 1 (engole ErroDeAplicacao = fail-open)
const FAILCLOSED = '  if (!(await modulosPermitidos()).some((m) => m.id === id)) notFound()\n}'
const FAILOPEN = `  try {
    if (!(await modulosPermitidos()).some((m) => m.id === id)) notFound()
  } catch (e) {
    if (e instanceof ErroDeAplicacao) return
    throw e
  }
}`
const failopen = (a) => [[pag(a), FAILCLOSED, FAILOPEN]]
const CSPCALL = 'politicaDeSeguranca(nonce))'
const cspShell = (expr) => [[P, CSPCALL, `politicaDeSeguranca(nonce)${expr})`]]

// trace
const TR_OK_TS = "  if (m && !zerado(m[1]!) && !zerado(m[2]!)) return recebido as string"
const TR_OK_JS = "    if (m && !zerado(m[1]) && !zerado(m[2]))\n        return recebido;"
const TR_RE = "/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/"
const TR_RE_FROUXO = "/^([0-9a-z]{2})-([0-9a-zA-Z]{32})-([0-9a-zA-Z]{16})-([0-9a-z]{2})$/"
// no dist do núcleo instalado em todas as apps
const emTodas = (f, de, para) => APPS.map((a) => [dist(a, f), de, para])
const emZonas = (f, de, para) => ZONAS.map((a) => [dist(a, f), de, para])
const FLASH_JS = "res.cookies.set(nomeFlash, '', { path: '/', secure: true, sameSite: 'lax', maxAge: 0 });"

const M = {
  // 1. exigirModulo fail-open, uma app por vez (o V1 da iteração 2)
  'F1-zona1': failopen('erp-zona-1'),
  'F1-zona2': failopen('erp-zona-2'),
  'F1-acesso': failopen('erp-zona-acesso'),
  'F1-shell': failopen('erp-shell'),
  // caça: fail-open só na página de detalhe do recurso da zona 1 (L1 não visita /zona1/recursos/*)
  'F1-recurso': [[REC, "  await exigirModulo('zona1.painel')\n", "  try { await exigirModulo('zona1.painel') } catch { /* fail-open local */ }\n"]],
  // caça, versão fiel ao V1: engole só erro com `codigo` (ErroDeAplicacao), deixa o notFound() subir
  'F1-recurso-b': [[REC, "  await exigirModulo('zona1.painel')\n", "  try { await exigirModulo('zona1.painel') } catch (e) { if (!(e && typeof e === 'object' && 'codigo' in e)) throw e }\n"]],
  // caça: a checagem estática procura o texto; comentado, a página fica sem guarda
  'S16-comentado': [[REC, "  await exigirModulo('zona1.painel')\n", "  // await exigirModulo('zona1.painel')\n"]],

  // 2. CSP do shell (G2)
  'CSP-sem-form-action': cspShell(".replace(\"form-action 'self'; \", '')"),
  'CSP-sem-img-src': cspShell(".replace(\"img-src 'self' data:; \", '')"),
  'CSP-sem-nonce': cspShell(".replace(/'nonce-[^']+' /g, '')"),
  'CSP-login-sem-csp': [[P, "    case 'publico':\n      return aplicarCsp(req, decisao.nonce)", "    case 'publico':\n      return NextResponse.next()"]],
  'CSP-nonce-fixo': [[D, "const nonce = crypto.randomUUID().replaceAll('-', '')", "const nonce = '0123456789abcdef0123456789abcdef'"]],
  'D-CSP-sem-form-action': emTodas('borda/csp.js', "form-action 'self'; ", ''),
  'N-CSP-sem-form-action': [[NS('borda/csp.ts'), "form-action 'self'; ", '']],
  'N-CSP-sem-img-src': [[NS('borda/csp.ts'), "img-src 'self' data:; ", '']],

  // 3. telemetria (G4)
  // T4a da iteração 2: sem o early return, anônimo vira 204 em processarLote e segue para o repasse
  'T-anon': [[RT, '  if (!sessao) return vazia(204)\n', ''], [RT, '    sessaoValida: true,\n    sub: sessao.sub,', "    sessaoValida: Boolean(sessao),\n    sub: sessao?.sub ?? 'anon',"]],
  'T-413-limite-infinito': [[RT, 'lerComLimite(req.body, TAMANHO_MAXIMO_BYTES)', 'lerComLimite(req.body, Infinity)']],
  'T-413-arraybuffer': [[RT, 'const corpo = await lerComLimite(req.body, TAMANHO_MAXIMO_BYTES)', 'const corpo: Uint8Array | null = new Uint8Array(await req.arrayBuffer())']],
  'T-413-sem-limite-algum': [[RT, 'lerComLimite(req.body, TAMANHO_MAXIMO_BYTES)', 'lerComLimite(req.body, Infinity)'],
             [T, '  if (contexto.tamanhoBytes > TAMANHO_MAXIMO_BYTES) {\n    return { status: 413 }\n  }', '']],
  'T-413-le-tudo': [[T, "    total += value.byteLength\n    if (total > limite) {\n      await leitor.cancel().catch(() => {})\n      return null\n    }\n    pedacos.push(value)\n  }",
                "    total += value.byteLength\n    pedacos.push(value)\n  }\n  if (total > limite) return null"]],
  'T-413-sem-content-length': [[RT, '  if (Number.isFinite(declarado) && declarado > TAMANHO_MAXIMO_BYTES) return vazia(413)\n', '']],
  'T-429-ignora': [[RT, '  if (resultado.status !== 204) return vazia(resultado.status, resultado.headers)\n', '']],
  'T-429-repassa-depois': [[RT, '  if (resultado.status !== 204) return vazia(resultado.status, resultado.headers)\n', ''],
             [RT, '  return vazia(204)\n}', '  return vazia(resultado.status, resultado.headers)\n}']],
  'T-400-repassa': [[RT, 'catch { return vazia(400) }', 'catch { lote = { bruto: new TextDecoder().decode(corpo) } }']],
  'T-400-engole-204': [[RT, 'catch { return vazia(400) }', 'catch { return vazia(204) }']],

  // 4. sonda
  'S-sem-timeout-const': [[SZ, 'export const TIMEOUT_PROBE_PADRAO_MS = 500', 'export const TIMEOUT_PROBE_PADRAO_MS = 600000']],
  'S-sem-signal': [[SZ, '        signal: AbortSignal.timeout(timeoutMs),\n', '']],
  'S-sem-timeout-instancia': [[SZ, 'export const cacheSaudePadrao = criarCacheSaudeZona()', 'export const cacheSaudePadrao = criarCacheSaudeZona(TTL_SAUDE_PADRAO_MS, 600_000)']],
  'S-500-vivo': [[SZ, 'return res.status < 500', 'return true']],
  'S-500-vivo-lt600': [[SZ, 'return res.status < 500', 'return res.status < 600']],
  'S-ttl-infinito': [[SZ, 'expiraEm: Date.now() + ttlMs', 'expiraEm: Infinity']],
  'S-ttl-ignorado': [[SZ, 'if (entrada && agora < entrada.expiraEm) {', 'if (entrada) {']],
  'S-ttl-so-fora-eterno': [[SZ, 'expiraEm: Date.now() + ttlMs', 'expiraEm: Date.now() + (saudavel ? ttlMs : Infinity)']],
  'S-ttl-instancia': [[SZ, 'export const cacheSaudePadrao = criarCacheSaudeZona()', 'export const cacheSaudePadrao = criarCacheSaudeZona(Infinity)']],
  'C1-caminho': [[Z, "(semQuery.startsWith('/') ? semQuery : `/${semQuery}`).toLowerCase()", "(semQuery.startsWith('/') ? semQuery : `/${semQuery}`)"]],
  'C1-estatico': [[D, 'if (caminho.toLowerCase().startsWith(zona.prefixoEstatico)) {', 'if (caminho.startsWith(zona.prefixoEstatico)) {']],
  'U6-otel-substring': [[D, "if (noSegmento(caminho, '/api/otel')) {", "if (caminho.startsWith('/api/otel')) {"]],
  'U6-auth-substring': [[D, "noSegmento(caminho, '/api/auth') ||", "caminho.startsWith('/api/auth') ||"]],
  'U6-otel-includes': [[D, "if (noSegmento(caminho, '/api/otel')) {", "if (caminho.includes('/api/otel')) {"]],
  'U6-api-toda': [[D, "if (noSegmento(caminho, '/api/otel')) {", "if (caminho.startsWith('/api')) {"]],
  'G5-estatico-antes-da-sonda': [[D, '    const saudavel = await cacheSaude.verificar(zona.urlSaude)', "    if (caminho.toLowerCase().startsWith(zona.prefixoEstatico)) return { acao: 'zona-estatica' }\n    const saudavel = await cacheSaude.verificar(zona.urlSaude)"]],

  // 5. trace (T1)
  'D-T1-zerado-aceito': emTodas('borda/trace.js', TR_OK_JS, '    if (m)\n        return recebido;'),
  'D-T1-regex-frouxa': emTodas('borda/trace.js', TR_RE, TR_RE_FROUXO),
  'D-T1-qualquer-texto': emTodas('borda/trace.js', TR_OK_JS, '    if (recebido)\n        return recebido;'),
  'N-T1-zerado-aceito': [[NS('borda/trace.ts'), TR_OK_TS, '  if (m) return recebido as string']],
  'N-T1-regex-frouxa': [[NS('borda/trace.ts'), TR_RE, TR_RE_FROUXO]],
  'N-T1-qualquer-texto': [[NS('borda/trace.ts'), TR_OK_TS, '  if (recebido) return recebido']],
  'T1-shell-repassa-cru': [[P, "headers.set('traceparent', garantirTraceparent(req.headers.get('traceparent')))", "headers.set('traceparent', req.headers.get('traceparent') ?? garantirTraceparent(null))"]],
  'T1-shell-ignora-navegador': [[P, "garantirTraceparent(req.headers.get('traceparent'))", 'garantirTraceparent(null)']],

  // 6. __Host-flash
  'F8-shell-sem-secure': [[P, "res.cookies.set('__Host-flash', '', { path: '/', secure: true, sameSite: 'lax', maxAge: 0 })", "res.cookies.set('__Host-flash', '', { path: '/', maxAge: 0 })"]],
  'M16-shell-nao-apaga': [[P, "    res.cookies.set('__Host-flash', '', { path: '/', secure: true, sameSite: 'lax', maxAge: 0 })\n", '']],
  'D-F8-zonas-sem-secure': emZonas('fabricas/criarProxy.js', FLASH_JS, "res.cookies.set(nomeFlash, '', { path: '/', maxAge: 0 });"),
  'D-M16-zonas-nao-apaga': emZonas('fabricas/criarProxy.js', `        if (flash)\n            ${FLASH_JS}`, ''),
}
const id = process.argv[2]
if (id === '--lista') { console.log(Object.keys(M).join(' ')); process.exit(0) }
if (!M[id]) { console.error('mutação desconhecida', id); process.exit(2) }
for (const [f, de, para] of M[id]) {
  const t = readFileSync(f, 'utf8')
  if (!t.includes(de)) { console.error(`NAO ACHOU em ${f}: ${de.slice(0, 80)}`); process.exit(3) }
  writeFileSync(f, t.split(de).join(para))
}
