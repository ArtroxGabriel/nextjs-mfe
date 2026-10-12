import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mutarIntegridadeVerificar } from './mutacoes-p1.mjs'

test('M3 retira somente integrity de verificar e preserva a confirmacao de publicar', () => {
  const fonte = readFileSync(new URL('./pacotes.mjs', import.meta.url), 'utf8')
  const mutada = mutarIntegridadeVerificar(fonte)
  const fim = fonte.indexOf('export async function migrarRegistro(')
  assert.equal(mutada.slice(mutada.indexOf('export async function migrarRegistro(')), fonte.slice(fim))
  assert.doesNotMatch(mutada.slice(0, mutada.indexOf('export async function migrarRegistro(')), /meta.dist\?\.integrity !== integrity/)
  assert.match(mutada, /if \(!meta \|\| meta.dist\?\.integrity !== integrity/)
})
