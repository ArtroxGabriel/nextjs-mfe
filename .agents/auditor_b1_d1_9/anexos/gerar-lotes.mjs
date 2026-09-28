// Gera os lotes do auditor_b1_d1_9: o catálogo da it.8 (specs A1/A1b/B/C/C0/C4 do auditor_b1_d1_8, as que ainda
// se aplicam ao código) e as mutações novas sobre a K5. Uso: node gerar-lotes.mjs  -> U.json, S.json, E.json
import { readFileSync, writeFileSync } from 'node:fs'
const AQUI = new URL('./', import.meta.url).pathname
const ANT = new URL('../../auditor_b1_d1_8/anexos/', import.meta.url).pathname
const ler = (f) => JSON.parse(readFileSync(ANT + f, 'utf8'))
const UNI_NUC = 'cd repos/erp-nucleo && pnpm test 2>&1'
const UNI_SCR = 'node --test base/scripts/*.test.mjs 2>&1'
const EST = 'node --test base/verificacao/saida-de-rede.test.mjs base/verificacao/seguranca-estatica.test.mjs 2>&1'
const E2E = 'task verificar:redis 2>&1'
const s = (id, inv, desc, edicoes, cmd, env = {}) => ({ id, inv, desc: 'NOVA: ' + desc, cmd, env, edicoes })
const trocarProva = (x) => ({ ...x, cmd: x.cmd.replace('.agents/auditor_b1_d1_8/anexos/prova-chave.mjs', '.agents/auditor_b1_d1_9/anexos/prova-chave.mjs') })

// ---------------------------------------------------------------- U: unidades (núcleo, stub, shell, scripts)
const U = [...ler('A1.json'), ...ler('A1b.json')]
const AMB = 'base/scripts/ambiente.mjs'
const FR = 'repos/erp-nucleo/scripts/fronteira.mjs'
const NUC = 'repos/erp-nucleo/src/'
U.push(
  s('AK1', 'inv. 15', 'ambienteDoPapel devolve o ambiente inteiro para qualquer papel (volta a exclusao nenhuma)', [{ arquivo: AMB, de: "  if (papel === 'shell') return { ...base }", para: "  if (papel) return { ...base }" }], UNI_SCR),
  s('AK2', 'inv. 15', "AMBIENTE_PERMITIDO.zona inclui 'REDIS_URL'", [{ arquivo: AMB, de: "'SESSAO_DIR', 'REDIS_URL_ZONA',", para: "'SESSAO_DIR', 'REDIS_URL', 'REDIS_URL_ZONA'," }], UNI_SCR),
  s('AK3', 'inv. 15', "AMBIENTE_PERMITIDO.zona inclui 'ERP_REDIS_SENHA_SHELL'", [{ arquivo: AMB, de: "'SESSAO_DIR', 'REDIS_URL_ZONA',", para: "'SESSAO_DIR', 'ERP_REDIS_SENHA_SHELL', 'REDIS_URL_ZONA'," }], UNI_SCR),
  s('AK4', 'inv. 15', "papelDe: a zona de acesso vira shell (dir === 'erp-zona-acesso')", [{ arquivo: AMB, de: "(dir === 'erp-shell' ? 'shell'", para: "(dir === 'erp-shell' || dir === 'erp-zona-acesso' ? 'shell'" }], UNI_SCR),
  s('AK4b', 'inv. 15', "papelDe: diretorio desconhecido (zona nova) vira shell", [{ arquivo: AMB, de: ": dir === 'erp-dominio-stub' ? 'dominio' : 'zona')", para: ": dir === 'erp-dominio-stub' ? 'dominio' : ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso'].includes(dir) ? 'zona' : 'shell')" }], UNI_SCR),
  s('AK5', 'inv. 15', 'filtro por prefixo invertido: p.startsWith(k) deixa passar REDIS_URL (prefixo de REDIS_URL_ZONA)', [{ arquivo: AMB, de: '.filter(([k]) => permitidas.includes(k))', para: '.filter(([k]) => permitidas.some((p) => p.startsWith(k)))' }], UNI_SCR),
  s('AK6u', 'inv. 15', "executar: o build ganha o ambiente inteiro numa linha a mais (linha do envProc intacta)", [{ arquivo: AMB, de: "    for (const [k, v] of Object.entries(extra)) {", para: "    if (fase === 'build') Object.assign(envProc, env)\n    for (const [k, v] of Object.entries(extra)) {" }], UNI_SCR),
  s('AK7u', 'inv. 15', "o build passa o ambiente inteiro como extra (build com extra: env)", [{ arquivo: AMB, de: "executar('build', dir, 'pnpm', ['build'], { esperar: true })", para: "executar('build', dir, 'pnpm', ['build'], { esperar: true, extra: env })" }], UNI_SCR),
  s('AK8u', 'inv. 15', "registrar ganha o ambiente inteiro numa linha a mais", [{ arquivo: AMB, de: "    for (const [k, v] of Object.entries(extra)) {", para: "    if (fase === 'registrar') Object.assign(envProc, env)\n    for (const [k, v] of Object.entries(extra)) {" }], UNI_SCR),
  // fronteira do núcleo (K5-4)
  s('FK1', 'inv. 15', 'simbolosDoShell devolve mapa vazio (sem derivacao)', [{ arquivo: FR, de: '  return mapa\n}\n\n/** Nomes que', para: '  return new Map()\n}\n\n/** Nomes que' }], UNI_NUC),
  s('FK2', 'inv. 15', 'simbolosDoShell registra o nome exportado, nao o do definidor (e.name em vez de propertyName ?? name)', [{ arquivo: FR, de: 'mapa.set((e.propertyName ?? e.name).text, definidor)', para: 'mapa.set(e.name.text, definidor)' }], UNI_NUC),
  s('FK3', 'inv. 15', 'temEscrita sem uniao/intersecao', [{ arquivo: FR, de: '  if (tipo.isUnionOrIntersection() && tipo.types.some', para: '  if (false && tipo.isUnionOrIntersection() && tipo.types.some' }], UNI_NUC),
  s('FK4', 'inv. 15', 'temEscrita sem Promise (getAwaitedType)', [{ arquivo: FR, de: '  if (aguardado && aguardado !== tipo && temEscrita', para: '  if (false && aguardado && aguardado !== tipo && temEscrita' }], UNI_NUC),
  s('FK5', 'inv. 15', 'temEscrita sem retorno de funcao (assinaturas)', [{ arquivo: FR, de: 'for (const assinatura of [...tipo.getCallSignatures(), ...tipo.getConstructSignatures()]) {', para: 'for (const assinatura of []) {' }], UNI_NUC),
  s('FK6', 'inv. 15', 'temEscrita sem recursao nas propriedades (so o primeiro nivel)', [{ arquivo: FR, de: '    if (decl && temEscrita(checker, checker.getTypeOfSymbolAtLocation(prop, decl)', para: '    if (false && decl && temEscrita(checker, checker.getTypeOfSymbolAtLocation(prop, decl)' }], UNI_NUC),
  s('FK7', 'inv. 15', "CAPACIDADES_DE_ESCRITA so com 'gravar'", [{ arquivo: FR, de: "new Set(['gravar', 'remover', 'autenticar', 'entrar', 'encerrar'])", para: "new Set(['gravar'])" }], UNI_NUC),
  s('FK8', 'inv. 15', 'regra por tipo isenta tambem adaptadores/ (como testing/)', [{ arquivo: FR, de: "if (camada === 'shell' || camada === 'testing') continue", para: "if (camada === 'shell' || camada === 'testing' || camada === 'adaptadores') continue" }], UNI_NUC),
  s('FK9', 'inv. 15', 'regra por tipo isenta tambem app/', [{ arquivo: FR, de: "if (camada === 'shell' || camada === 'testing') continue", para: "if (camada === 'shell' || camada === 'testing' || camada === 'app') continue" }], UNI_NUC),
  s('FK10', 'inv. 15', 'regra por tipo sem isencao de testing/ (controle: o src real tem de reprovar)', [{ arquivo: FR, de: "if (camada === 'shell' || camada === 'testing') continue", para: "if (camada === 'shell') continue" }], UNI_NUC),
  s('FK11', 'inv. 15', 'doDefinidor sem !reexport (reexport no definidor vale como declaracao)', [{ arquivo: FR, de: 'const doDefinidor = !reexport && simbolos.get(exportado.name) === rel', para: 'const doDefinidor = simbolos.get(exportado.name) === rel' }], UNI_NUC),
  s('FK12', 'inv. 15', 'isencao do definidor vale em qualquer arquivo (sem relArquivo === definidor)', [{ arquivo: FR, de: 'const ehDeclaracao = relArquivo === simbolos.get(no.text) && no.parent?.name === no', para: 'const ehDeclaracao = no.parent?.name === no' }], UNI_NUC),
  s('FK13', 'inv. 15', 'isencao do definidor para qualquer no com nome (sem o tipo da declaracao)', [{ arquivo: FR, de: "          const ehDeclaracao = relArquivo === simbolos.get(no.text) && no.parent?.name === no\n            && (ts.isFunctionDeclaration(no.parent) || ts.isVariableDeclaration(no.parent) || ts.isClassDeclaration(no.parent))", para: '          const ehDeclaracao = relArquivo === simbolos.get(no.text)' }], UNI_NUC),
  s('FK14', 'inv. 15', 'regra por nome volta a isentar o arquivo definidor inteiro (revert parcial do V4)', [{ arquivo: FR, de: '          if (!ehDeclaracao) {', para: '          if (!ehDeclaracao && relArquivo !== simbolos.get(no.text)) {' }], UNI_NUC),
  s('FK15', 'inv. 15', 'regra por tipo desligada (so a regra por nome)', [{ arquivo: FR, de: '  erros.push(...exportsComEscrita(src, simbolos))', para: '  void exportsComEscrita' }], UNI_NUC),
  // produto do núcleo: formas novas que a fronteira deveria pegar
  s('N38m', 'inv. 15', "raiz: export * as adaptadorRedis from './adaptadores/sessao-redis.js' (namespace com o escritor)", [{ arquivo: NUC + 'index.ts', de: "export { acessoHttp } from './adaptadores/acesso-http.js'\n", para: "export { acessoHttp } from './adaptadores/acesso-http.js'\nexport * as adaptadorRedis from './adaptadores/sessao-redis.js'\n" }], UNI_NUC),
  s('N38n', 'inv. 15', "raiz: export * from './adaptadores/sessao-arquivo.js' (estrela traz o escritor)", [{ arquivo: NUC + 'index.ts', de: "export { sessaoArquivo } from './adaptadores/sessao-arquivo.js'\n", para: "export * from './adaptadores/sessao-arquivo.js'\n" }], UNI_NUC),
  s('N38o', 'inv. 15', "escritor novo publicado em /shell por export * (fabricas/renovacao.ts devolve { gravar }) e embrulhado em /app", [
    { arquivo: NUC + 'fabricas/renovacao.ts', novo: true, para: "import 'server-only'\nimport type { StoreDeSessao } from '../portas/sessao.js'\nexport function renovador(store: StoreDeSessao) {\n  return { gravar: store.gravar.bind(store) }\n}\n" },
    { arquivo: NUC + 'shell/index.ts', de: "export { sessaoRedisDeEscrita } from '../adaptadores/sessao-redis.js'\n", para: "export { sessaoRedisDeEscrita } from '../adaptadores/sessao-redis.js'\nexport * from '../fabricas/renovacao.js'\n" },
    { arquivo: NUC + 'app/index.ts', de: "} from '../fabricas/criarPaginas.js'\n", para: "} from '../fabricas/criarPaginas.js'\nexport { renovador } from '../fabricas/renovacao.js'\n" },
  ], UNI_NUC),
  s('N38p', 'inv. 15', "escritor novo em /shell por export * cujo tipo nao tem gravar (renovarSessao(id): Promise<void>, grava com o escritor que ele mesmo monta de um store injetado) embrulhado em /app", [
    { arquivo: NUC + 'fabricas/renovacao.ts', novo: true, para: "import 'server-only'\nimport type { StoreDeSessao, SessaoArmazenada } from '../portas/sessao.js'\nexport async function renovarSessao(store: StoreDeSessao, id: string, s: SessaoArmazenada): Promise<void> {\n  await store.gravar(id, s)\n}\n" },
    { arquivo: NUC + 'shell/index.ts', de: "export { sessaoRedisDeEscrita } from '../adaptadores/sessao-redis.js'\n", para: "export { sessaoRedisDeEscrita } from '../adaptadores/sessao-redis.js'\nexport * from '../fabricas/renovacao.js'\n" },
    { arquivo: NUC + 'app/index.ts', de: "} from '../fabricas/criarPaginas.js'\n", para: "} from '../fabricas/criarPaginas.js'\nimport { renovarSessao } from '../fabricas/renovacao.js'\nexport const renovar = (...a: Parameters<typeof renovarSessao>) => renovarSessao(...a)\n" },
  ], UNI_NUC),
  // suspeita do revisor: arquivo novo de fabricas/ ou adaptadores/ que grava sem tipo com gravar/remover
  s('NR1', 'inv. 15', "suspeita do revisor: fabricas/renovar.ts grava pelo cliente Redis injetado (cast do ClienteRedisDeLeitura para set), tipo (cliente, id, valor) => Promise<void>, exportado por /app", [
    { arquivo: NUC + 'fabricas/renovar.ts', novo: true, para: "import 'server-only'\nimport type { ClienteRedisDeLeitura } from '../adaptadores/sessao-redis.js'\nexport async function renovar(cliente: ClienteRedisDeLeitura, chave: string, valor: string): Promise<void> {\n  await (cliente as unknown as { set(k: string, v: string, o: { PX: number }): Promise<unknown> }).set(chave, valor, { PX: 3_600_000 })\n}\n" },
    { arquivo: NUC + 'app/index.ts', de: "} from '../fabricas/criarPaginas.js'\n", para: "} from '../fabricas/criarPaginas.js'\nexport { renovar } from '../fabricas/renovar.js'\n" },
  ], UNI_NUC),
  s('NR2', 'inv. 15', "suspeita do revisor: adaptadores/sessao-disco.ts grava arquivo de sessao com node:fs (tipo (dir, id, s) => Promise<void>), exportado pela raiz", [
    { arquivo: NUC + 'adaptadores/sessao-disco.ts', novo: true, para: "import 'server-only'\nimport { writeFile } from 'node:fs/promises'\nimport { join } from 'node:path'\nimport type { SessaoArmazenada } from '../portas/sessao.js'\nexport async function guardarSessao(dir: string, id: string, s: SessaoArmazenada): Promise<void> {\n  await writeFile(join(dir, `${id}.json`), JSON.stringify(s))\n}\n" },
    { arquivo: NUC + 'index.ts', de: "export { acessoHttp } from './adaptadores/acesso-http.js'\n", para: "export { acessoHttp } from './adaptadores/acesso-http.js'\nexport { guardarSessao } from './adaptadores/sessao-disco.js'\n" },
  ], UNI_NUC),
  s('NR3', 'inv. 15', "suspeita do revisor, forma literal: fabricas/renovar.ts importa 'redis' direto (createClient) e grava; exportado por /app", [
    { arquivo: NUC + 'fabricas/renovar.ts', novo: true, para: "import 'server-only'\nimport { createClient } from 'redis'\nexport async function renovar(url: string, chave: string, valor: string): Promise<void> {\n  const c = await createClient({ url }).connect()\n  await c.set(chave, valor)\n}\n" },
    { arquivo: NUC + 'app/index.ts', de: "} from '../fabricas/criarPaginas.js'\n", para: "} from '../fabricas/criarPaginas.js'\nexport { renovar } from '../fabricas/renovar.js'\n" },
  ], UNI_NUC),
)

// ---------------------------------------------------------------- S: estático (N8, segurança)
const SAIDA = 'base/verificacao/saida-de-rede.mjs'
const SEG = 'base/verificacao/seguranca-estatica.mjs'
const S = ler('B.json').filter((x) => !['SR1', 'SR2', 'FR2'].includes(x.id))
// FR2 da it.8 (lista fixa) não existe mais: vira FK1/FK2 acima; a ideia (identidadeDev fora) reaplicada abaixo em U
U.push(s('FR2b', 'inv. 15', "L4 (FR2): identidadeDev e ATORES_DE_DESENVOLVIMENTO saem de shell/index.ts e voltam para a raiz", [
  { arquivo: NUC + 'shell/index.ts', de: "export { identidadeDev, ATORES_DE_DESENVOLVIMENTO } from '../adaptadores/identidade-dev.js'\n", para: '' },
  { arquivo: NUC + 'index.ts', de: "export { acessoHttp } from './adaptadores/acesso-http.js'\n", para: "export { acessoHttp } from './adaptadores/acesso-http.js'\nexport { identidadeDev, ATORES_DE_DESENVOLVIMENTO } from './adaptadores/identidade-dev.js'\n" },
], UNI_NUC))
S.push(
  s('SK1', 'inv. 4 (N8)', 'nomesLigados: catch nao liga o parametro', [{ arquivo: SAIDA, de: "  else if (ts.isCatchClause(escopo)) { if (escopo.variableDeclaration) nomesDoPadrao(escopo.variableDeclaration.name, escopo.variableDeclaration, mapa) }\n", para: '' }], EST),
  s('SK2', 'inv. 4 (N8)', 'nomesLigados: for/for-in/for-of nao ligam', [{ arquivo: SAIDA, de: '  else if (ts.isForStatement(escopo) || ts.isForInStatement(escopo) || ts.isForOfStatement(escopo)) declaracoesDaLista(escopo.initializer, mapa)\n', para: '' }], EST),
  s('SK3', 'inv. 4 (N8)', 'nomesLigados: bloco nao liga (SR1 da it.8 na forma nova)', [{ arquivo: SAIDA, de: '  if (ts.isSourceFile(escopo) || ts.isBlock(escopo) || ts.isModuleBlock(escopo)) nomesDasInstrucoes', para: '  if (ts.isSourceFile(escopo) || ts.isModuleBlock(escopo)) nomesDasInstrucoes' }], EST),
  s('SK4', 'inv. 4 (N8)', 'nomesDasInstrucoes: sobe declaracao de bloco aninhado para o de fora (hoisting largo demais)', [{ arquivo: SAIDA, de: '    if (ts.isVariableStatement(s)) declaracoesDaLista(s.declarationList, mapa)\n', para: '    if (ts.isVariableStatement(s)) declaracoesDaLista(s.declarationList, mapa)\n    else if (ts.isBlock(s)) nomesDasInstrucoes(s.statements, mapa)\n' }], EST),
  s('SK5', 'inv. 4 (N8)', 'nomesDasInstrucoes: for-of/for-in/for sobem a declaracao do laco para o bloco de fora', [{ arquivo: SAIDA, de: '    if (ts.isVariableStatement(s)) declaracoesDaLista(s.declarationList, mapa)\n', para: '    if (ts.isVariableStatement(s)) declaracoesDaLista(s.declarationList, mapa)\n    else if (ts.isForOfStatement(s) || ts.isForInStatement(s) || ts.isForStatement(s)) declaracoesDaLista(s.initializer, mapa)\n' }], EST),
  s('SK6', 'inv. 4 (N8)', 'nomesDasInstrucoes: classe liga os parametros do constructor no escopo de fora (propriedade de parametro)', [{ arquivo: SAIDA, de: "    else if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isEnumDeclaration(s)) && s.name) mapa.set(s.name.text, s)\n", para: "    else if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isEnumDeclaration(s)) && s.name) {\n      mapa.set(s.name.text, s)\n      if (ts.isClassDeclaration(s)) for (const m of s.members) if (ts.isConstructorDeclaration(m)) for (const p of m.parameters) nomesDoPadrao(p.name, p, mapa)\n    }\n" }], EST),
  s('SK7', 'inv. 4 (N8)', 'nomesDasInstrucoes: try/catch sobe o parametro do catch para o bloco de fora', [{ arquivo: SAIDA, de: '    if (ts.isVariableStatement(s)) declaracoesDaLista(s.declarationList, mapa)\n', para: '    if (ts.isVariableStatement(s)) declaracoesDaLista(s.declarationList, mapa)\n    else if (ts.isTryStatement(s) && s.catchClause?.variableDeclaration) nomesDoPadrao(s.catchClause.variableDeclaration.name, s.catchClause.variableDeclaration, mapa)\n' }], EST),
  s('SK8', 'inv. 4 (N8)', 'valorConstante aceita let (sem a flag Const)', [{ arquivo: SAIDA, de: '      && (d.parent.flags & ts.NodeFlags.Const) !== 0', para: '' }], EST),
  s('SK9', 'inv. 4 (N8)', 'valorConstante procura a primeira const do arquivo com o nome (ignora a sombra)', [{ arquivo: SAIDA, de: '    const d = declaracaoDe(id, id.text)\n', para: '    const d = declaracaoDe(id.getSourceFile().statements[0] ?? id, id.text) ?? declaracaoDe(id, id.text)\n' }], EST),
  s('SK10', 'inv. 4 (N8)', 'valorConstante devolve undefined para nao constante (revert do achado da K5)', [{ arquivo: SAIDA, de: '    return ehConst ? avaliarStringConstante(d.initializer) : null', para: '    return ehConst ? avaliarStringConstante(d.initializer) : undefined' }], EST),
  s('SK11', 'inv. 4 (N8)', 'chaveIdentificador volta a ?? undefined quando nao e identificador constante', [{ arquivo: SAIDA, de: '      const chave = chaveLiteral ?? chaveCalculada ?? chaveIdentificador', para: '      const chave = chaveLiteral ?? chaveCalculada ?? (chaveIdentificador ?? undefined)' }], EST),
  s('SK12', 'inv. 4 (N8)', 'declaracaoDe comeca no proprio no (inclui o uso)', [{ arquivo: SAIDA, de: '    for (let n = no.parent; n; n = n.parent) {', para: '    for (let n = no; n; n = n.parent) {' }], EST),
  s('SK13', 'inv. 4 (N8)', 'import type liga o nome (sem o isTypeOnly)', [{ arquivo: SAIDA, de: '    else if (ts.isImportDeclaration(s) && s.importClause && !s.importClause.isTypeOnly) {', para: '    else if (ts.isImportDeclaration(s) && s.importClause) {' }], EST),
  s('SK14', 'inv. 4 (N8)', 'funcao liga so os parametros simples (desestruturacao nao)', [{ arquivo: SAIDA, de: '    for (const p of escopo.parameters) nomesDoPadrao(p.name, p, mapa)', para: '    for (const p of escopo.parameters) if (ts.isIdentifier(p.name)) mapa.set(p.name.text, p)' }], EST),
  s('SK15', 'inv. 4 (N8)', 'switch/case nao liga', [{ arquivo: SAIDA, de: '  else if (ts.isCaseBlock(escopo)) nomesDasInstrucoes(escopo.clauses.flatMap((c) => c.statements), mapa)\n', para: '' }], EST),
  s('SK16', 'inv. 4 (N8)', 'declaracaoDe para na primeira funcao (nao ve variavel de fora na closure)', [{ arquivo: SAIDA, de: '      const d = ligados(n).get(nome)\n      if (d) return d\n', para: '      const d = ligados(n).get(nome)\n      if (d) return d\n      if (ts.isFunctionLike(n)) return null\n' }], EST),
  // L3 e raiz (seguranca-estatica)
  s('LK1', 'inv. 11', 'L3: regra do shorthand removida', [{ arquivo: SEG, de: "      if (ts.isShorthandPropertyAssignment(no) && ['assetPrefix', 'basePath'].includes(no.name.text)) {", para: "      if (false && ts.isShorthandPropertyAssignment(no) && ['assetPrefix', 'basePath'].includes(no.name.text)) {" }], EST),
  s('LK2', 'inv. 11', 'L3: regra da atribuicao removida', [{ arquivo: SEG, de: "        if (['assetPrefix', 'basePath'].includes(chave) && !ts.isStringLiteral(no.right)", para: "        if (false && ['assetPrefix', 'basePath'].includes(chave) && !ts.isStringLiteral(no.right)" }], EST),
  s('LK3', 'inv. 11', 'L3: atribuicao so por propriedade (config[\'basePath\'] = x passa)', [{ arquivo: SEG, de: "        const chave = ts.isPropertyAccessExpression(no.left) ? no.left.name.text : texto(no.left.argumentExpression)", para: "        const chave = ts.isPropertyAccessExpression(no.left) ? no.left.name.text : null" }], EST),
  s('LK4', 'inv. 11', 'L3: atribuicao aceita template com expressao como literal', [{ arquivo: SEG, de: "        if (['assetPrefix', 'basePath'].includes(chave) && !ts.isStringLiteral(no.right) && !ts.isNoSubstitutionTemplateLiteral(no.right)) {", para: "        if (['assetPrefix', 'basePath'].includes(chave) && !ts.isStringLiteral(no.right) && !ts.isNoSubstitutionTemplateLiteral(no.right) && !ts.isTemplateExpression(no.right) && !ts.isPropertyAccessExpression(no.right)) {" }], EST),
  s('RK1', '-', 'varrerSeguranca ignora o parametro raiz (volta a RAIZ fixa)', [{ arquivo: SEG, de: '    const raizDaApp = join(raiz, app)\n', para: '    const raizDaApp = join(RAIZ, app)\n' }], EST),
  s('RK2', '-', 'varrerSeguranca: caminho do achado relativo a RAIZ fixa', [{ arquivo: SEG, de: '        resultado.push(`${relative(raiz, f)}:${a.linha} [${a.regra}] ${a.motivo}`)', para: '        resultado.push(`${relative(RAIZ, f)}:${a.linha} [${a.regra}] ${a.motivo}`)' }], EST),
)

// ---------------------------------------------------------------- E: ponta a ponta
const E = [...ler('C.json').filter((x) => !/^AMB\d$/.test(x.id) && x.id !== 'XR20q').map(trocarProva), ...ler('C0.json').map(trocarProva), ...ler('C4.json').map((x) => ({ ...x, env: { CONSTRUIR: '1' } }))]
E.push(
  s('AK6', 'inv. 15', "executar: o build ganha o ambiente inteiro numa linha a mais (sem build na rodada: CONSTRUIR=1 e fonte das apps intacto)", [{ arquivo: AMB, de: "    for (const [k, v] of Object.entries(extra)) {", para: "    if (fase === 'build') Object.assign(envProc, env)\n    for (const [k, v] of Object.entries(extra)) {" }], E2E, { CONSTRUIR: '1' }),
  s('AK6t', 'inv. 15', "o mesmo AK6 com CONSTRUIR=tudo (build de verdade na rodada)", [{ arquivo: AMB, de: "    for (const [k, v] of Object.entries(extra)) {", para: "    if (fase === 'build') Object.assign(envProc, env)\n    for (const [k, v] of Object.entries(extra)) {" }], E2E, { CONSTRUIR: 'tudo' }),
  s('AK7', 'inv. 15', "o build passa o ambiente inteiro como extra (extras ficam fora da conferencia), CONSTRUIR=tudo", [{ arquivo: AMB, de: "executar('build', dir, 'pnpm', ['build'], { esperar: true })", para: "executar('build', dir, 'pnpm', ['build'], { esperar: true, extra: env })" }], E2E, { CONSTRUIR: 'tudo' }),
  s('AK8', 'inv. 15', "registrar ganha o ambiente inteiro numa linha a mais", [{ arquivo: AMB, de: "    for (const [k, v] of Object.entries(extra)) {", para: "    if (fase === 'registrar') Object.assign(envProc, env)\n    for (const [k, v] of Object.entries(extra)) {" }], E2E),
  s('AK9', 'inv. 15', "start do dominio com o ambiente inteiro", [{ arquivo: AMB, de: "    for (const [k, v] of Object.entries(extra)) {", para: "    if (dir === 'erp-dominio-stub') Object.assign(envProc, env)\n    for (const [k, v] of Object.entries(extra)) {" }], E2E),
  s('AK10', 'inv. 15', "start da zona com a senha do shell por outro nome (ERP_SENHA = REDIS_URL)", [{ arquivo: AMB, de: "    for (const [k, v] of Object.entries(extra)) {", para: "    if (fase === 'start' && dir !== 'erp-shell' && env.REDIS_URL) envProc.ERP_CACHE_URL = env.REDIS_URL\n    for (const [k, v] of Object.entries(extra)) {" }], E2E),
  s('AK11', 'inv. 15', "subirApp (zona que volta no meio da verificacao) com o ambiente inteiro por extra", [{ arquivo: AMB, de: "    apps.set(dir, executar('start', dir, 'pnpm', ['start']))\n    const { porta, saude }", para: "    apps.set(dir, executar('start', dir, 'pnpm', ['start'], { extra: env }))\n    const { porta, saude }" }], E2E),
)
for (const [n, l] of [['U', U], ['S', S], ['E', E]]) writeFileSync(AQUI + n + '.json', JSON.stringify(l, null, 1))
console.log('U', U.length, 'S', S.length, 'E', E.length)
