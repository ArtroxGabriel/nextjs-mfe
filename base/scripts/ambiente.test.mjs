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
