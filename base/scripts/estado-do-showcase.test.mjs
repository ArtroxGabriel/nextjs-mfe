import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { atoresAusentes, avisoDeEstado, SEMENTE_DIR } from './estado-do-showcase.mjs'

const pessoas = (...logins) => JSON.stringify({ pessoas: logins.map((login, i) => ({ id: `p-${i}`, login })) })

function pastas() {
  const raiz = mkdtempSync(join(tmpdir(), 'estado-showcase-'))
  const semente = join(raiz, 'semente')
  const estado = join(raiz, 'estado')
  mkdirSync(semente)
  mkdirSync(estado)
  writeFileSync(join(semente, 'gestao-acesso-v2.json'), pessoas('ana', 'bruno', 'eva'))
  writeFileSync(join(semente, 'dominio-a.json'), JSON.stringify({ recursos: [] }))
  return { semente, estado }
}

test('estado gravado antes da eva: acusa a falta e sugere showcase:dados:resetar', () => {
  const { semente, estado } = pastas()
  writeFileSync(join(estado, 'gestao-acesso-v2.json'), pessoas('ana', 'bruno'))
  const achados = atoresAusentes(estado, semente)
  assert.deepEqual(achados, [{ arquivo: 'gestao-acesso-v2.json', faltam: ['eva'] }])
  const aviso = avisoDeEstado(achados, estado)
  assert.match(aviso, /faltam eva/)
  assert.match(aviso, /task showcase:dados:resetar/)
})

test('estado com todos os atores, com pessoa a mais ou ainda nao gravado: nenhum aviso', () => {
  const { semente, estado } = pastas()
  assert.deepEqual(atoresAusentes(estado, semente), [], 'arquivo ainda nao gravado parte da semente')
  writeFileSync(join(estado, 'gestao-acesso-v2.json'), pessoas('ana', 'bruno', 'eva', 'nova'))
  writeFileSync(join(estado, 'dominio-a.json'), JSON.stringify({ recursos: [1] }))
  assert.deepEqual(atoresAusentes(estado, semente), [])
  assert.equal(avisoDeEstado([], estado), null)
  assert.deepEqual(atoresAusentes(join(estado, 'nao-existe'), semente), [])
})

test('estado ilegivel e acusado, sem derrubar o showcase', () => {
  const { semente, estado } = pastas()
  writeFileSync(join(estado, 'gestao-acesso-v2.json'), '{ quebrado')
  const achados = atoresAusentes(estado, semente)
  assert.deepEqual(achados, [{ arquivo: 'gestao-acesso-v2.json', ilegivel: true }])
  assert.match(avisoDeEstado(achados, estado), /ilegivel/)
})

test('a semente real do stub tem os cinco atores do showcase, e uma copia dela nao gera aviso', () => {
  const { estado } = pastas()
  assert.deepEqual(atoresAusentes(SEMENTE_DIR, SEMENTE_DIR), [])
  writeFileSync(join(estado, 'gestao-acesso-v2.json'), pessoas('ana', 'bruno', 'carla', 'davi'))
  const [achado] = atoresAusentes(estado)
  assert.ok(achado.faltam.includes('eva'), JSON.stringify(achado))
})
