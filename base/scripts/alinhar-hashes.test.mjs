import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pacotesErp, trocarIntegrity } from './alinhar-hashes.mjs'

const LOCK = `packages:

  '@erp/contratos@0.3.1':
    resolution: {integrity: sha512-AAA==, tarball: http://localhost:4873/@erp/contratos/-/contratos-0.3.1.tgz}

  '@erp/nucleo@0.8.2':
    resolution: {integrity: sha512-BBB==, tarball: http://localhost:4873/@erp/nucleo/-/nucleo-0.8.2.tgz}

  'next@16.3.4':
    resolution: {integrity: sha512-NEXT==}
`

test('lista só os pacotes @erp com o hash gravado', () => {
  assert.deepEqual(pacotesErp(LOCK), [
    { nome: '@erp/contratos', versao: '0.3.1', integrity: 'sha512-AAA==' },
    { nome: '@erp/nucleo', versao: '0.8.2', integrity: 'sha512-BBB==' },
  ])
})

test('troca só o hash do pacote pedido, preservando o tarball e os outros', () => {
  const novo = trocarIntegrity(LOCK, '@erp/nucleo', '0.8.2', 'sha512-ZZZ==')
  assert.match(novo, /'@erp\/nucleo@0\.8\.2':\n {4}resolution: \{integrity: sha512-ZZZ==, tarball: /)
  assert.match(novo, /sha512-AAA==/)
  assert.match(novo, /sha512-NEXT==/)
  assert.equal(novo.length, LOCK.length)
})

test('versão ausente não muda nada', () => {
  assert.equal(trocarIntegrity(LOCK, '@erp/nucleo', '0.8.1', 'sha512-ZZZ=='), LOCK)
})
