import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { precisaConstruir, RAIZ as RAIZ_DOS_REPOS } from './ambiente.mjs'

function app({ build, fonte }) {
  const d = mkdtempSync(join(tmpdir(), 'app-'))
  mkdirSync(join(d, 'lib')); writeFileSync(join(d, 'lib', 'a.ts'), 'x')
  writeFileSync(join(d, 'package.json'), '{}')
  for (const f of [join(d, 'lib', 'a.ts'), join(d, 'package.json')]) utimesSync(f, fonte, fonte)
  if (build !== undefined) {
    mkdirSync(join(d, '.next')); writeFileSync(join(d, '.next', 'BUILD_ID'), 'b')
    utimesSync(join(d, '.next', 'BUILD_ID'), build, build)
  }
  return d
}

test('sem build: precisa construir', () => assert.equal(precisaConstruir(app({ fonte: 100 })), true))
test('build mais novo que o fonte: nao precisa', () => assert.equal(precisaConstruir(app({ build: 200, fonte: 100 })), false))
test('fonte mais novo que o build: precisa', () => assert.equal(precisaConstruir(app({ build: 100, fonte: 200 })), true))
test('mudanca so no package.json (versao de pacote) tambem conta', () => {
  const d = app({ build: 200, fonte: 100 })
  utimesSync(join(d, 'package.json'), 300, 300)
  assert.equal(precisaConstruir(d), true)
})

// --- auditor_b1_d1_3 (L4: AM1-AM3) ---
test('AM1/AM2: cada entrada do build, mudada sozinha, pede reconstrucao', () => {
  for (const entrada of ['app/zona/page.tsx', 'lib/a.ts', 'proxy.ts', 'next.config.ts', 'package.json', 'pnpm-lock.yaml', 'instrumentation.ts', 'acesso.manifesto.ts']) {
    const d = app({ build: 200, fonte: 100 })
    const f = join(d, entrada)
    mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, 'x')
    utimesSync(f, 100, 100)
    assert.equal(precisaConstruir(d), false, `${entrada} antigo nao deveria pedir build`)
    utimesSync(f, 300, 300)
    assert.equal(precisaConstruir(d), true, `${entrada} mudou e o build velho seria usado`)
  }
})

test('LA (auditor_b1_d1_9, D15): mudanca em base/scripts/ambiente.mjs pede reconstrucao de app da base', () => {
  const d = app({ build: 200, fonte: 100 })
  const mockAmbiente = join(d, 'ambiente-fake.mjs')
  writeFileSync(mockAmbiente, '// ambiente')
  utimesSync(mockAmbiente, 100, 100)
  assert.equal(precisaConstruir(d, { scriptAmbiente: mockAmbiente }), false, 'ambiente antigo nao deveria pedir build')
  utimesSync(mockAmbiente, 300, 300)
  assert.equal(precisaConstruir(d, { scriptAmbiente: mockAmbiente }), true, 'ambiente mais novo que o build deve pedir reconstrucao')
})

test('AM3: subir recusa porta ocupada antes de subir qualquer coisa', { timeout: 300_000 }, async () => {
  const { createServer } = await import('node:http')
  const { subir, APPS } = await import('./ambiente.mjs')
  const s = createServer((req, res) => res.end())
  const porta = APPS[0].porta
  const ok = await new Promise((r) => { s.once('error', () => r(false)); s.listen(porta, '127.0.0.1', () => r(true)) })
  if (!ok) return   // a base esta no ar nesta maquina: a porta ja esta ocupada, e o teste nao pode prova-lo sozinho
  try {
    // se subir passar (checagem removida), derruba o que subiu antes de reprovar: nada fica orfao
    const erro = await subir().then((amb) => { amb.derrubar(); return null }, (e) => e)
    assert.match(erro?.message ?? 'subiu com a porta ocupada', new RegExp(`porta ${porta} ja esta em uso`))
  } finally {
    s.close()
  }
})

// --- auditor_b1_d1_8 (V1, L6: AMB4/AMB6): ambiente de zona e domínio por lista de inclusão ---
test('V1: zona e dominio nao recebem nenhum valor com a senha de escrita, venha no nome que vier', async () => {
  const { ambienteDoPapel } = await import('./ambiente.mjs')
  const senha = 'segredo-de-escrita-k5'
  const base = {
    PATH: '/usr/bin', HOME: '/home/x', SESSAO_DIR: '/tmp/s', DADOS_DIR: '/tmp/d', REDIS_URL_ZONA: 'redis://zona:leitura@h',
    REDIS_URL: `redis://default:${senha}@h`, ERP_REDIS_SENHA_SHELL: senha, QUALQUER_NOVA: senha, ERP_OUTRA: senha,
  }
  for (const papel of ['zona', 'dominio']) {
    const env = ambienteDoPapel(papel, base)
    const vazou = Object.entries(env).filter(([, v]) => String(v).includes(senha))
    assert.deepEqual(vazou, [], `${papel} recebeu a senha`)
    assert.equal(env.PATH, '/usr/bin', `${papel} perdeu o PATH`)
  }
  assert.equal(ambienteDoPapel('zona', base).REDIS_URL_ZONA, base.REDIS_URL_ZONA)
  assert.equal(ambienteDoPapel('zona', base).DADOS_DIR, undefined, 'zona nao le os dados do dominio')
  assert.equal(ambienteDoPapel('dominio', base).DADOS_DIR, base.DADOS_DIR)
  assert.equal(ambienteDoPapel('dominio', base).SESSAO_DIR, undefined, 'dominio nao le sessao')
  // dentes: o shell, dono da escrita, recebe tudo
  assert.equal(ambienteDoPapel('shell', base).REDIS_URL, base.REDIS_URL)
  assert.throws(() => ambienteDoPapel('outro', base), /papel desconhecido/)
})

test('C3: so o shell recebe svc.shell e as origens permitidas, e o que o chamador definiu vence', async () => {
  const { ambienteDoPapel } = await import('./ambiente.mjs')
  const sh = ambienteDoPapel('shell', { PATH: '/usr/bin' })
  assert.equal(sh.ERP_TOKEN_SERVICO, 'svc.shell')
  assert.equal(sh.ERP_ZONAS_ORIGENS_PERMITIDAS, '127.0.0.1:*,localhost:*')
  for (const papel of ['zona', 'dominio']) {
    const env = ambienteDoPapel(papel, { PATH: '/usr/bin' })
    assert.equal(env.ERP_TOKEN_SERVICO, undefined, `${papel} recebeu o token do shell`)
    assert.equal(env.ERP_ZONAS_ORIGENS_PERMITIDAS, undefined, `${papel} recebeu as origens`)
  }
  const dado = ambienteDoPapel('shell', { ERP_TOKEN_SERVICO: 'outro', ERP_ZONAS_ORIGENS_PERMITIDAS: 'h:1' })
  assert.equal(dado.ERP_TOKEN_SERVICO, 'outro')
  assert.equal(dado.ERP_ZONAS_ORIGENS_PERMITIDAS, 'h:1')
})

test('V1: o papel sai do diretorio; toda app que nao e o shell e zona', async () => {
  const { papelDe, APPS } = await import('./ambiente.mjs')
  assert.equal(papelDe('erp-shell'), 'shell')
  assert.equal(papelDe('erp-dominio-stub'), 'dominio')
  for (const { dir } of APPS.filter((a) => a.dir !== 'erp-shell')) assert.equal(papelDe(dir), 'zona', dir)
  assert.equal(papelDe('erp-zona-nova'), 'zona', 'zona nova nasce sem a credencial de escrita')
})

test('V1: todo processo nasce por um unico ponto, com o ambiente do papel (build, start, registrar, avulsa)', () => {
  const fonte = readFileSync(new URL('./ambiente.mjs', import.meta.url), 'utf8')
  // spawn e execFileSync importados uma vez e chamados uma vez cada, dentro de `executar`
  assert.equal((fonte.match(/\bspawn\s*\(/g) ?? []).length, 1, 'spawn fora de executar')
  assert.equal((fonte.match(/\bexecFileSync\s*\(/g) ?? []).length, 1, 'execFileSync fora de executar')
  assert.equal((fonte.match(/\benv\s*:/g) ?? []).length, 1, 'processo com ambiente escolhido fora de executar')
  assert.match(fonte, /const envProc = ambienteDoPapel\(papelDe\(dir\), env\)/)
  assert.doesNotMatch(fonte, /child_process['"]\s*\)?\s*\.\s*(spawn|exec)|require\(|import\(\s*['"]node:child_process/, 'child_process por outro caminho')
})

// --- V1 no núcleo: o que a ZONA carrega, não o pacote inteiro --------------------------------------
// O núcleo é um pacote só, mas a zona nunca importa `@erp/nucleo/shell` (invariante 15, checado na
// verificação estática). O que só o caminho do shell lê não chega à zona e não entra na lista dela.
// Duas regras, nesta ordem:
//  1. módulo: só contam os arquivos alcançáveis pelos imports relativos a partir de cada subpath
//     publicado, menos `./shell` (provedores de identidade e escritores ficam de fora sozinhos);
//  2. função: leitura num módulo compartilhado, mas dentro de uma função que só o shell chama, entra
//     em LIDAS_SO_NO_SHELL com o motivo. O teste prova cada entrada: toda leitura da variável no arquivo
//     está dentro da função, e nenhum arquivo alcançável pela zona (fora o que a define) usa a função.
//     Variável nova lida pela zona, no mesmo arquivo ou fora da função, continua reprovando.

const ts = createRequire(join(RAIZ_DOS_REPOS, 'erp-shell', 'package.json'))('typescript')

const LIDAS_SO_NO_SHELL = [
  { arquivo: 'fabricas/criarNucleo.ts', variavel: 'ERP_RENOVACAO_JANELA_S', funcao: 'criarNucleoDoShell',
    motivo: 'janela da renovação proativa; só a fábrica do shell renova (ADR-0013, decisão 4), exportada só por /shell' },
  { arquivo: 'fabricas/criarNucleo.ts', variavel: 'ERP_RENOVACAO_LOCK_S', funcao: 'criarNucleoDoShell',
    motivo: 'lock da renovação; mesma fábrica, só o shell a cria' },
  { arquivo: 'fabricas/criarNucleo.ts', variavel: 'ERP_RENOVACAO_ESPERA_MS', funcao: 'criarNucleoDoShell',
    motivo: 'espera de quem perde o lock com o token vencido (D19-B); só a fábrica do shell renova' },
  { arquivo: 'fabricas/criarNucleo.ts', variavel: 'ERP_RENOVACAO_ESPERA_PASSO_MS', funcao: 'criarNucleoDoShell',
    motivo: 'passo da releitura durante essa espera (D19-B); mesma fábrica, só o shell a cria' },
  { arquivo: 'interno/login.ts', variavel: 'ERP_LOGIN_TRANSACAO_S', funcao: 'lerVidaDaTransacaoMs',
    motivo: 'vida da transação de login; chamada só por identidadeDev e identidadeOidc, que só /shell exporta' },
]

const fonteTs = (arquivo) => ts.createSourceFile(arquivo, readFileSync(arquivo, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

/** Arquivos de `erp-nucleo/src` alcançáveis pela zona: fecho dos imports relativos a partir dos subpaths, menos `./shell`. */
function alcancaveisPelaZona(raiz) {
  const nucleo = join(raiz, 'erp-nucleo')
  const pkg = JSON.parse(readFileSync(join(nucleo, 'package.json'), 'utf8'))
  const fila = Object.entries(pkg.exports).filter(([k]) => k !== './shell')
    .map(([, v]) => join(nucleo, v.default.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '.ts')))
  const vistos = new Set()
  while (fila.length) {
    const arquivo = fila.pop()
    if (vistos.has(arquivo)) continue
    vistos.add(arquivo)
    for (const st of fonteTs(arquivo).statements) {
      const mod = (ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : null
      if (mod?.startsWith('.')) fila.push(join(dirname(arquivo), mod.replace(/\.js$/, '.ts')))
    }
  }
  return vistos
}

/** Leituras de `process.env.<variavel>` em `fonte`, com a função nomeada que as contém (ou null). */
function leiturasDe(sf, variavel) {
  const achadas = []
  const nomeDe = (n) => (ts.isFunctionDeclaration(n) && n.name) ? n.name.text
    : (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) ? n.name.text : null
  const andar = (n, funcoes) => {
    const nome = nomeDe(n)
    const dentro = nome ? [...funcoes, nome] : funcoes
    const ehEnv = (e) => ts.isPropertyAccessExpression(e) && e.name.text === 'env' && ts.isIdentifier(e.expression) && e.expression.text === 'process'
    if ((ts.isPropertyAccessExpression(n) && ehEnv(n.expression) && n.name.text === variavel)
      || (ts.isElementAccessExpression(n) && ehEnv(n.expression) && ts.isStringLiteral(n.argumentExpression) && n.argumentExpression.text === variavel)) {
      achadas.push(dentro)
    }
    ts.forEachChild(n, (f) => andar(f, dentro))
  }
  andar(sf, [])
  return achadas
}

/** Identificadores `nome` usados em `sf` (não em comentário), fora a própria declaração. */
function usa(sf, nome) {
  let achou = false
  const andar = (n) => {
    if (ts.isIdentifier(n) && n.text === nome && !((ts.isFunctionDeclaration(n.parent) || ts.isVariableDeclaration(n.parent)) && n.parent.name === n)) achou = true
    ts.forEachChild(n, andar)
  }
  andar(sf)
  return achou
}

/** Variáveis que o núcleo, como a zona o carrega, lê. Lança se uma entrada de LIDAS_SO_NO_SHELL não se sustenta. */
function lidasPeloNucleoDaZona(raiz) {
  const src = join(raiz, 'erp-nucleo', 'src')
  const alcancaveis = alcancaveisPelaZona(raiz)
  const lidas = new Set()
  for (const arquivo of alcancaveis) {
    const isentas = LIDAS_SO_NO_SHELL.filter((e) => join(src, e.arquivo) === arquivo)
    for (const v of variaveisLidas(readFileSync(arquivo, 'utf8'))) {
      const e = isentas.find((x) => x.variavel === v)
      if (!e) { lidas.add(v); continue }
      const leituras = leiturasDe(fonteTs(arquivo), v)
      assert.ok(leituras.length > 0 && leituras.every((fs) => fs.includes(e.funcao)), `${e.arquivo}: ${v} lida fora de ${e.funcao}`)
      for (const outro of alcancaveis) {
        assert.ok(outro === arquivo || !usa(fonteTs(outro), e.funcao), `${e.funcao} usada por ${outro}, que a zona carrega`)
      }
    }
  }
  for (const e of LIDAS_SO_NO_SHELL) {
    assert.ok(alcancaveis.has(join(src, e.arquivo)), `${e.arquivo}: excecao sem motivo, a zona nem carrega o arquivo`)
    assert.ok(variaveisLidas(readFileSync(join(src, e.arquivo), 'utf8')).includes(e.variavel), `${e.arquivo}: excecao velha, ${e.variavel} nao e mais lida`)
    assert.ok(e.motivo.length > 20, `${e.variavel}: excecao sem motivo`)
  }
  return lidas
}

test('V1 no nucleo: so conta o que a zona carrega, e a excecao por funcao tem dentes', () => {
  const alcancaveis = [...alcancaveisPelaZona(RAIZ_DOS_REPOS)].map((a) => a.split('/src/')[1])
  for (const deve of ['index.ts', 'fabricas/criarNucleo.ts', 'fabricas/criarProxy.ts', 'adaptadores/sessao-redis.ts', 'interno/login.ts']) assert.ok(alcancaveis.includes(deve), deve)
  for (const nao of ['shell/index.ts', 'adaptadores/identidade-dev.ts', 'adaptadores/identidade-oidc.ts']) assert.ok(!alcancaveis.includes(nao), nao)
  const sf = (texto) => ts.createSourceFile('x.ts', texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  assert.deepEqual(leiturasDe(sf('export function soShell() { return process.env.A }'), 'A'), [['soShell']])
  assert.deepEqual(leiturasDe(sf("export const f = () => process.env['A']\nconst g = process.env.A"), 'A'), [['f'], []])
  assert.ok(usa(sf('import { f } from "./x.js"; f()'), 'f'))
  assert.ok(!usa(sf('// f aparece so em comentario\nexport function f() {}'), 'f'))
})

/** Variáveis de ambiente que um fonte lê: `process.env.X`, `process.env['X']` e `const { X, Y: y } = process.env`. */
function variaveisLidas(texto) {
  const diretas = [...texto.matchAll(/process\.env(?:\.([A-Z_0-9]+)|\[['"]([A-Z_0-9]+)['"]\])/g)].map((m) => m[1] ?? m[2])
  const desestruturadas = [...texto.matchAll(/\{([^{}]*)\}\s*=\s*process\.env\b/g)]
    .flatMap((m) => m[1].split(',').map((p) => p.trim().match(/^([A-Z_0-9]+)\b/)?.[1]).filter(Boolean))
  return [...diretas, ...desestruturadas]
}

/** Variáveis que o fonte de uma app (ou pasta) lê, fora dependências, builds e testes. */
function lidas(dir) {
  const andar = (d) => readdirSync(d).flatMap((n) => {
    if (['node_modules', '.next', 'dist', 'test'].includes(n)) return []
    const p = join(d, n)
    return statSync(p).isDirectory() ? andar(p) : /\.(ts|tsx|mjs|js)$/.test(n) ? [p] : []
  })
  return new Set(andar(dir).flatMap((f) => variaveisLidas(readFileSync(f, 'utf8'))))
}

test('V1: a lista de inclusao cobre toda variavel que zona e dominio leem (variavel nova nao some calada)', async () => {
  const { AMBIENTE_PERMITIDO, RAIZ } = await import('./ambiente.mjs')
  // dentes: as três formas de ler (challenger_b1_d1_9: desestruturação passava sem ser vista)
  assert.deepEqual([...variaveisLidas("process.env.A; process.env['B']; const { C, D: d, E = '1' } = process.env")].sort(), ['A', 'B', 'C', 'D', 'E'])
  const zona = new Set([...lidasPeloNucleoDaZona(RAIZ), ...['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso'].flatMap((z) => [...lidas(join(RAIZ, z))])])
  // REDIS_URL a zona só lê para se recusar a subir com ela (lib/redis.ts); nunca a recebe
  zona.delete('REDIS_URL')
  assert.ok(zona.size >= 8, 'varredura vazia')
  assert.deepEqual([...zona].filter((v) => !AMBIENTE_PERMITIDO.zona.includes(v)), [])
  const dominio = lidas(join(RAIZ, 'erp-dominio-stub', 'src'))
  assert.ok(dominio.has('DADOS_DIR'), 'varredura do dominio vazia')
  assert.deepEqual([...dominio].filter((v) => !AMBIENTE_PERMITIDO.dominio.includes(v)), [])
  assert.ok(!AMBIENTE_PERMITIDO.zona.some((v) => /^REDIS_URL$|SENHA_SHELL/.test(v)), 'credencial de escrita na lista da zona')
})

// --- auditor_d2_1 (F04): o que só o shell lê não chega à zona nem ao domínio ---
// O segredo do cliente OIDC é o caso que importa: com ele, uma zona (que lê o refresh token de toda sessão no
// Redis, D17) renovaria qualquer sessão. A lista sai do código: o que o shell lê (a app e o que o núcleo lê só
// no shell) e nem zona nem domínio leem; o piso explícito dá dentes à derivação.
const SO_DO_SHELL_PISO = ['IDP_CLIENTE_SEGREDO', 'IDP_CLIENTE_ID', 'IDP_URL_RETORNO', 'IDP_URL_POS_LOGOUT']

test('F04: variavel so do shell (segredo do cliente OIDC e afins) nunca entra no ambiente de zona nem de dominio', async () => {
  const { AMBIENTE_PERMITIDO, RAIZ, ambienteDoPapel } = await import('./ambiente.mjs')
  const zona = new Set([...lidasPeloNucleoDaZona(RAIZ), ...['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso'].flatMap((z) => [...lidas(join(RAIZ, z))])])
  const dominio = lidas(join(RAIZ, 'erp-dominio-stub', 'src'))
  const shell = new Set([...lidas(join(RAIZ, 'erp-shell')), ...LIDAS_SO_NO_SHELL.map((e) => e.variavel)])
  const soDoShell = [...shell].filter((v) => !zona.has(v) && !dominio.has(v))
  for (const v of SO_DO_SHELL_PISO) assert.ok(soDoShell.includes(v), `${v}: o shell nao le mais, ou zona/dominio passaram a ler`)
  // as credenciais de escrita do Redis a zona lê só para se recusar a subir com elas; nunca as recebe
  const proibidas = [...new Set([...soDoShell, 'REDIS_URL', 'ERP_REDIS_SENHA_SHELL'])]
  for (const papel of ['zona', 'dominio']) {
    assert.deepEqual(proibidas.filter((v) => AMBIENTE_PERMITIDO[papel].includes(v)), [], `variavel so do shell na lista de ${papel}`)
    const base = Object.fromEntries(proibidas.map((v) => [v, `valor-de-${v}`]))
    assert.deepEqual(Object.keys(ambienteDoPapel(papel, { ...base, PATH: '/usr/bin' })), ['PATH'], `${papel} recebeu variavel so do shell`)
  }
  // dentes: o shell recebe o segredo
  assert.equal(ambienteDoPapel('shell', { IDP_CLIENTE_SEGREDO: 's' }).IDP_CLIENTE_SEGREDO, 's')
})

// --- C3: cada zona registra a própria rota no deploy ---------------------------------------------------
test('C3: toda zona tem o script registrar-rota, com id do pacote, origem do ambiente e as travas do registro de destinos', () => {
  const zonas = [['erp-zona-1', 'zona1', 3001], ['erp-zona-2', 'zona2', 3002], ['erp-zona-acesso', 'acesso', 3003]]
  for (const [dir, id, porta] of zonas) {
    const pkg = JSON.parse(readFileSync(join(RAIZ_DOS_REPOS, dir, 'package.json'), 'utf8'))
    assert.equal(pkg.scripts['registrar-rota'], 'node scripts/registrar-rota.ts', dir)
    const fonte = readFileSync(join(RAIZ_DOS_REPOS, dir, 'scripts', 'registrar-rota.ts'), 'utf8')
    // o id vem do pacote (manifesto ou constante), nunca do ambiente
    assert.match(fonte, id === 'acesso' ? /const id = 'acesso'/ : /const id = manifesto\.id/, `${dir}: id`)
    assert.doesNotMatch(fonte, /process\.env\.\w*(ID|ZONA_ID|NOME)\b/, `${dir}: id lido do ambiente`)
    assert.equal((fonte.match(/process\.env\./g) ?? []).length, 3, `${dir}: so ACESSO_URL, ERP_ZONA_ORIGEM_INTERNA e ERP_TOKEN_SERVICO`)
    assert.match(fonte, new RegExp(`process\\.env\\.ERP_ZONA_ORIGEM_INTERNA \\?\\? 'http://127\\.0\\.0\\.1:${porta}'`), `${dir}: origem padrao`)
    assert.match(fonte, /redirect: 'manual'/, `${dir}: segue redirecionamento`)
    assert.match(fonte, /AbortSignal\.timeout\(/, `${dir}: sem timeout`)
    assert.match(fonte, /r\.status !== 200[\s\S]*process\.exit\(1\)/, `${dir}: nao sai com 1`)
  }
})

test('C3: a origem interna da zona entra na lista de inclusao da zona e nao na do dominio', async () => {
  const { AMBIENTE_PERMITIDO } = await import('./ambiente.mjs')
  assert.ok(AMBIENTE_PERMITIDO.zona.includes('ERP_ZONA_ORIGEM_INTERNA'))
  assert.ok(!AMBIENTE_PERMITIDO.dominio.includes('ERP_ZONA_ORIGEM_INTERNA'))
})

test('C3: ambiente.mjs roda registrar-rota de todas as zonas, nao so das que tem manifesto', () => {
  const fonte = readFileSync(new URL('./ambiente.mjs', import.meta.url), 'utf8')
  assert.match(fonte, /APPS\.filter\(\(\{ dir \}\) => temScript\(join\(RAIZ, dir\), 'registrar-rota'\)\)/)
})
