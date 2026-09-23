import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs'
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
