import { writeFileSync } from 'node:fs'
const EST = 'node --test base/verificacao/saida-de-rede.test.mjs base/verificacao/seguranca-estatica.test.mjs 2>&1'
const s = (id, inv, desc, edicoes, cmd = EST) => ({ id, inv, desc, cmd, edicoes })
const Z1 = 'repos/erp-zona-1/'
const PG = Z1 + 'app/zona1/page.tsx'
const ILHA = { arquivo: Z1 + 'app/zona1/BotaoDeAviso.tsx', de: 'export function BotaoDeAviso({ texto }: { texto: string })', para: 'export function BotaoDeAviso({ texto }: { texto: string; extra?: unknown })' }
const BOTAO = '{recursos && <BotaoDeAviso texto={`${recursos.length} recursos visíveis para você`} />}'
const RET = '  return (\n    <>\n      <h1>Painel da zona 1</h1>'
const pag = (antes, botao) => [ILHA, { arquivo: PG, de: RET, para: antes + '\n' + RET }, { arquivo: PG, de: BOTAO, para: botao }]
const SE = 'base/verificacao/seguranca-estatica.mjs', SR = 'base/verificacao/saida-de-rede.mjs'
const L = [
  // --- catálogo it.4: produto pego pelo estático
  s('E02', 'inv. 3', 'zona 1 lib/redis.ts sem import server-only', [{ arquivo: Z1 + 'lib/redis.ts', de: "import 'server-only'\n", para: '' }]),
  s('E02b', 'inv. 3', 'zona 1 lib/nucleo.ts sem import server-only', [{ arquivo: Z1 + 'lib/nucleo.ts', de: "import 'server-only'\n", para: '' }]),
  s('E02c', 'inv. 3', 'zona 2 lib/pagina.ts sem import server-only', [{ arquivo: 'repos/erp-zona-2/lib/pagina.ts', de: "import 'server-only'\n", para: '' }]),
  s('E10c', 'inv. 2', 'acesso/page.tsx: campos com cadastro: JSON.stringify(p)', [{ arquivo: 'repos/erp-zona-acesso/app/acesso/page.tsx', de: 'campos={{ pessoa: p.id, modulo: m.id }}>', para: 'campos={{ pessoa: p.id, modulo: m.id, cadastro: JSON.stringify(p) }}>' }]),
  s('E10b', 'inv. 2', 'zona1: `${JSON.stringify(recursos)}` na prop texto da ilha', [{ arquivo: PG, de: BOTAO, para: '{recursos && <BotaoDeAviso texto={`${JSON.stringify(recursos)}`} />}' }]),
  s('XR15', 'inv. 4 (N8)', 'fetch para fora dentro do arquivo da excecao (zona 1 lib/redis.ts)', [{ arquivo: Z1 + 'lib/redis.ts', de: "import 'server-only'\n", para: "import 'server-only'\nexport const _v = () => fetch('http://127.0.0.1:4999/xr15')\n" }]),
  s('XR16', 'inv. 4 (N8)', 'fetch em pasta nova fora de app/ e lib/ (servicos/rede.ts)', [{ arquivo: Z1 + 'servicos/rede.ts', novo: true, para: "import 'server-only'\nexport const v = () => fetch('http://127.0.0.1:4999/xr16')\n" }]),
  s('XE41', 'inv. 11', 'NEXT_PUBLIC_API_TOKEN em componentes/x.ts', [{ arquivo: Z1 + 'componentes/x.ts', novo: true, para: "export const t = process.env.NEXT_PUBLIC_API_TOKEN\n" }]),
  s('XR17', 'inv. 4 (N8)', 'excecao nova (lib/dominio-a.ts da zona 1) com motivo longo', [{ arquivo: SR, de: "  'erp-zona-2/scripts/registrar-manifesto.ts': { permite: ['fetch'], motivo: DEPLOY },\n", para: "  'erp-zona-2/scripts/registrar-manifesto.ts': { permite: ['fetch'], motivo: DEPLOY },\n  'erp-zona-1/lib/dominio-a.ts': { permite: ['fetch'], motivo: 'cliente do dominio A com timeout e sem seguir redirecionamento, auditado' },\n" }]),
  // --- K4-1: tipos na ilha, erros de boa-fé no produto (zona 1, ilha aceita extra?: unknown)
  s('T1', 'inv. 2', 'NOVA: objeto opcional: extra={primeiro?.custo} (custo?: {valor, centro})', pag('  const primeiro = recursos?.[0]', '{recursos && <BotaoDeAviso texto="x" extra={primeiro?.custo} />}')),
  s('T2', 'inv. 2', 'NOVA: uniao objeto|string: envio.resumo: string | Recurso[]', pag("  const envio: { resumo: string | NonNullable<typeof recursos> } = { resumo: recursos ?? 'nenhum' }", '{recursos && <BotaoDeAviso texto="x" extra={envio.resumo} />}')),
  s('T3', 'inv. 2', 'NOVA: array de string com o centro de custo: envio.centros: string[]', pag("  const envio = { centros: (recursos ?? []).map((r) => r.custo?.centro ?? '') }", '{recursos && <BotaoDeAviso texto="x" extra={envio.centros} />}')),
  s('T4', 'inv. 2', 'NOVA: tipo generico: Aviso<T>({ v }: { v: { item: T } }) passa v.item a ilha', pag('  function Aviso<T>({ v }: { v: { item: T } }) { return <BotaoDeAviso texto="x" extra={v.item} /> }', '{recursos && <Aviso v={{ item: recursos }} />}')),
  s('T5', 'inv. 2', 'NOVA: any implicito: JSON.parse(JSON.stringify(recursos)) em envio.copia', pag('  const envio = { copia: JSON.parse(JSON.stringify(recursos)) }', '{recursos && <BotaoDeAviso texto="x" extra={envio.copia} />}')),
  s('T6', 'inv. 2', 'NOVA: tipo {} (qualquer nao-nulo): envio.resumo: {}', pag('  const envio: { resumo: {} } = { resumo: recursos ?? 0 }', '{recursos && <BotaoDeAviso texto="x" extra={envio.resumo} />}')),
  s('T7', 'inv. 2', 'NOVA: cast mentiroso: extra={envio.resumo as unknown as string}', pag('  const envio = { resumo: recursos }', '{recursos && <BotaoDeAviso texto="x" extra={envio.resumo as unknown as string} />}')),
  s('T8', 'inv. 2', 'NOVA: objeto por elemento: extra={recursos[0]}', pag('', '{recursos && <BotaoDeAviso texto="x" extra={recursos[0]} />}')),
  // --- mutações do analisador (K4-1)
  s('TA1', 'inv. 2', 'NOVA: ehTipoEscalar com some em vez de every na uniao', [{ arquivo: SE, de: 't.types.every(ehTipoEscalar)', para: 't.types.some(ehTipoEscalar)' }]),
  s('TA2', 'inv. 2', 'NOVA: ESCALARES inclui Object', [{ arquivo: SE, de: '| ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void', para: '| ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void | ts.TypeFlags.Object' }]),
  s('TA3', 'inv. 2', 'NOVA: x.campo volta a passar sem o verificador de tipos (revert do K4-1)', [{ arquivo: SE, de: 'return !tipos || ehTipoEscalar(tipos.getTypeAtLocation(e))', para: 'return true' }]),
  s('TA4', 'inv. 2', 'NOVA: programaDaApp ignora os arquivos varridos (so cfg.fileNames)', [{ arquivo: SE, de: 'rootNames: [...new Set([...(cfg?.fileNames ?? []), ...arquivos])]', para: 'rootNames: [...new Set([...(cfg?.fileNames ?? [])])]' }]),
  s('TA5', 'inv. 2', 'NOVA: programaDaApp sem allowJs (.js/.mjs sem tipo)', [{ arquivo: SE, de: 'allowJs: true, noEmit: true', para: 'allowJs: false, noEmit: true' }]),
  s('TA6', 'inv. 2', 'NOVA: any conta como escalar', [{ arquivo: SE, de: '(t.flags & ESCALARES) !== 0)', para: '(t.flags & (ESCALARES | ts.TypeFlags.Any)) !== 0)' }]),
  s('TA9', 'inv. 2', 'NOVA: varrerSeguranca deixa de passar o programa (apps reais sem tipo)', [{ arquivo: SE, de: '{ raizDaApp, exigirServerOnly, programa })', para: '{ raizDaApp, exigirServerOnly })' }]),
  s('TA10', 'inv. 2', 'NOVA: sem programa, x.campo passa (falha aberta) mesmo com CAMPOS_COMPLEXOS vazio', [{ arquivo: SE, de: "const CAMPOS_COMPLEXOS = new Set(['lista',", para: "const CAMPOS_COMPLEXOS = new Set([] || ['lista'," }]),
  // --- XN09 (K4-4)
  s('XN09a', 'inv. 11', 'NOVA: zona 1 next.config: assetPrefix por shorthand de variavel lida do ambiente', [{ arquivo: Z1 + 'next.config.ts', de: "const config: NextConfig = {\n  poweredByHeader: false,\n  // Prefixo exclusivo de assets (limitação 5). O shell reencaminha /zona1-static/* para cá.\n  assetPrefix: '/zona1-static',", para: "const assetPrefix = process.env.ZONA1_ASSET_PREFIX ?? '/zona1-static'\nconst config: NextConfig = {\n  poweredByHeader: false,\n  assetPrefix," }]),
  s('XN09b', 'inv. 11', 'NOVA: zona 1 next.config: config.assetPrefix = process.env.X por atribuicao', [{ arquivo: Z1 + 'next.config.ts', de: 'export default config', para: "if (process.env.ZONA1_ASSET_PREFIX) config.assetPrefix = process.env.ZONA1_ASSET_PREFIX\nexport default config" }]),
  s('XN09c', 'inv. 11', 'NOVA: analisador: regra XN09 removida', [{ arquivo: SE, de: "if (ts.isPropertyAssignment(no) && ['assetPrefix', 'basePath'].includes(", para: "if (false && ts.isPropertyAssignment(no) && ['assetPrefix', 'basePath'].includes(" }]),
  // --- saida-de-rede (K3)
  s('SR1', 'inv. 4 (N8)', 'NOVA: bloco nao abre escopo', [{ arquivo: SR, de: '|| ts.isArrowFunction(no) || ts.isMethodDeclaration(no) || ts.isBlock(no)', para: '|| ts.isArrowFunction(no) || ts.isMethodDeclaration(no)' }]),
  s('SR2', 'inv. 4 (N8)', 'NOVA: volta o conjunto unico por arquivo (revert do XR20)', [{ arquivo: SR, de: 'if (criaEscopo) escopos.push(new Set())', para: 'if (false) escopos.push(new Set())' }]),
  s('SR3', 'inv. 4 (N8)', 'NOVA: fontesDaApp volta a pular test/ em qualquer nivel', [{ arquivo: SE, de: "if (d === raizDaApp && n === 'test') return []", para: "if (n === 'test') return []" }]),
  s('SR4', 'inv. 4 (N8)', 'NOVA: todo next/* permitido de novo', [{ arquivo: SR, de: "    return SUBPATHS_NEXT_PERMITIDOS.has(mod)\n", para: '    return true\n' }]),
  s('SR5', 'inv. 4 (N8)', 'NOVA: chave por identificador constante ignorada', [{ arquivo: SR, de: 'const chave = chaveLiteral ?? chaveCalculada ?? chaveIdentificador', para: 'const chave = chaveLiteral ?? chaveCalculada' }]),
  s('SR6', 'inv. 4 (N8)', 'NOVA: chave calculada por concatenacao ignorada', [{ arquivo: SR, de: 'const chave = chaveLiteral ?? chaveCalculada ?? chaveIdentificador', para: 'const chave = chaveLiteral ?? chaveIdentificador' }]),
  s('SR7', 'inv. 4 (N8)', 'NOVA: next/font/* aberto para qualquer subpath de next/ que comece por font', [{ arquivo: SR, de: "if (mod.startsWith('next/font/')) return true", para: "if (mod.startsWith('next/font')) return true" }]),
  // produto: sombra da global por parâmetro de constructor (variante do XR20 que a K3 não cobre)
  s('XR20q', 'inv. 4 (N8)', 'NOVA: zona 1 lib/dominio-a.ts: classe com constructor(fetch) no arquivo + listarRecursos faz fetch direto para fora', [{ arquivo: Z1 + 'lib/dominio-a.ts', de: 'export const listarRecursos = cache(async () =>\n', para: "export class Transporte { enviar: (u: string) => Promise<unknown>; constructor(fetch: (u: string) => Promise<unknown>) { this.enviar = fetch } }\nexport const listarRecursos = cache(async () =>\n  (await fetch('http://127.0.0.1:4999/xr20q').catch(() => null), 0) ||\n" }]),
  s('XR20r', 'inv. 4 (N8)', 'NOVA: zona 1 lib/dominio-a.ts: try/catch (fetch) no topo + fetch direto para fora', [{ arquivo: Z1 + 'lib/dominio-a.ts', de: 'export const listarRecursos = cache(async () =>\n', para: "try { /* nada */ } catch (fetch) { void fetch }\nexport const listarRecursos = cache(async () =>\n  (await fetch('http://127.0.0.1:4999/xr20r').catch(() => null), 0) ||\n" }]),
  // fronteira do núcleo (K3)
  s('FR1', 'inv. 15', 'NOVA: fronteira: arquivo na raiz de src/ volta a nao ser camada', [{ arquivo: 'repos/erp-nucleo/scripts/fronteira.mjs', de: "if (primeira.endsWith('.ts')) return 'raiz'", para: "if (false) return 'raiz'" }], 'cd repos/erp-nucleo && pnpm test 2>&1'),
  s('FR2', 'inv. 15', 'NOVA: fronteira: identidadeDev e ATORES_DE_DESENVOLVIMENTO fora da lista', [{ arquivo: 'repos/erp-nucleo/scripts/fronteira.mjs', de: "  ['identidadeDev', 'adaptadores/identidade-dev.ts'],\n  ['ATORES_DE_DESENVOLVIMENTO', 'adaptadores/identidade-dev.ts'],\n", para: '' }], 'cd repos/erp-nucleo && pnpm test 2>&1'),
  s('FR3', 'inv. 15', 'NOVA: fronteira: checagem de simbolo so em app/ (raiz liberada)', [{ arquivo: 'repos/erp-nucleo/scripts/fronteira.mjs', de: "if (origem !== 'shell') {", para: "if (origem === 'app') {" }], 'cd repos/erp-nucleo && pnpm test 2>&1'),
]
writeFileSync(new URL('./B.json', import.meta.url), JSON.stringify(L, null, 1))
