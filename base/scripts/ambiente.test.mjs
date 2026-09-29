import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { precisaConstruir } from './ambiente.mjs'

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
  for (const entrada of ['app/zona/page.tsx', 'lib/a.ts', 'proxy.ts', 'next.config.ts', 'package.json', 'pnpm-lock.yaml', 'zonas.json', 'acesso.manifesto.ts']) {
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

/** Variáveis de ambiente que um fonte lê: `process.env.X`, `process.env['X']` e `const { X, Y: y } = process.env`. */
function variaveisLidas(texto) {
  const diretas = [...texto.matchAll(/process\.env(?:\.([A-Z_0-9]+)|\[['"]([A-Z_0-9]+)['"]\])/g)].map((m) => m[1] ?? m[2])
  const desestruturadas = [...texto.matchAll(/\{([^{}]*)\}\s*=\s*process\.env\b/g)]
    .flatMap((m) => m[1].split(',').map((p) => p.trim().match(/^([A-Z_0-9]+)\b/)?.[1]).filter(Boolean))
  return [...diretas, ...desestruturadas]
}

test('V1: a lista de inclusao cobre toda variavel que zona e dominio leem (variavel nova nao some calada)', async () => {
  const { AMBIENTE_PERMITIDO, RAIZ } = await import('./ambiente.mjs')
  const { readdirSync, statSync } = await import('node:fs')
  const lidas = (dir) => {
    const andar = (d) => readdirSync(d).flatMap((n) => {
      if (['node_modules', '.next', 'dist', 'test'].includes(n)) return []
      const p = join(d, n)
      return statSync(p).isDirectory() ? andar(p) : /\.(ts|tsx|mjs|js)$/.test(n) ? [p] : []
    })
    return new Set(andar(dir).flatMap((f) => variaveisLidas(readFileSync(f, 'utf8'))))
  }
  // dentes: as três formas de ler (challenger_b1_d1_9: desestruturação passava sem ser vista)
  assert.deepEqual([...variaveisLidas("process.env.A; process.env['B']; const { C, D: d, E = '1' } = process.env")].sort(), ['A', 'B', 'C', 'D', 'E'])
  const zona = new Set([...lidas(join(RAIZ, 'erp-nucleo', 'src')), ...['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso'].flatMap((z) => [...lidas(join(RAIZ, z))])])
  // REDIS_URL a zona só lê para se recusar a subir com ela (lib/redis.ts); nunca a recebe
  zona.delete('REDIS_URL')
  assert.ok(zona.size >= 8, 'varredura vazia')
  assert.deepEqual([...zona].filter((v) => !AMBIENTE_PERMITIDO.zona.includes(v)), [])
  const dominio = lidas(join(RAIZ, 'erp-dominio-stub', 'src'))
  assert.ok(dominio.has('DADOS_DIR'), 'varredura do dominio vazia')
  assert.deepEqual([...dominio].filter((v) => !AMBIENTE_PERMITIDO.dominio.includes(v)), [])
  assert.ok(!AMBIENTE_PERMITIDO.zona.some((v) => /^REDIS_URL$|SENHA_SHELL/.test(v)), 'credencial de escrita na lista da zona')
})
