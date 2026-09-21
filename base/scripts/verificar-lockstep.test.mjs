import { test } from 'node:test'
import assert from 'node:assert/strict'
import { versoesDoNucleo, divergencias } from './verificar-lockstep.mjs'

const v = (dir, declarada, travada = declarada) => ({ dir, declarada, travada })

test('as aplicacoes reais estao em lockstep', () => {
  assert.deepEqual(divergencias(versoesDoNucleo()), [])
})
test('uma aplicacao numa versao diferente reprova', () => {
  const e = divergencias([v('a', '0.3.2'), v('b', '0.3.2'), v('c', '0.5.0')])
  assert.ok(e.some((x) => /diferentes/.test(x)), e.join('\n'))
})
test('faixa de versao (^, ~) reprova: lockstep exige versao exata', () => {
  assert.ok(divergencias([v('a', '^0.3.2', '0.3.2'), v('b', '0.3.2')]).some((x) => /exata/.test(x)))
})
test('package.json e lockfile discordando reprova', () => {
  assert.ok(divergencias([v('a', '0.3.2', '0.3.1')]).some((x) => /lockfile/.test(x)))
})
test('aplicacao sem o nucleo reprova', () => {
  assert.ok(divergencias([v('a', null, null)]).some((x) => /nao depende/.test(x)))
})
