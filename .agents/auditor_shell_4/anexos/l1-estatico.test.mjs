// auditor_shell_4: só os testes estáticos do base.test.mjs (texto copiado por faixa de linhas), sem subir a base
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { RAIZ } from '../scripts/ambiente.mjs'
test('invariante 16 estatico: toda pagina de modulo chama exigirModulo', () => {
  const paginas = (d) => readdirSync(d).flatMap((n) => {
    const p = join(d, n)
    if (n === '(publico)') return []
    return statSync(p).isDirectory() ? paginas(p) : n === 'page.tsx' ? [p] : []
  })
  let total = 0
  for (const app of ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    for (const f of paginas(join(RAIZ, app, 'app'))) {
      assert.match(readFileSync(f, 'utf8'), /await exigirModulo\('[a-z0-9-]+\.[a-z0-9-]+'\)/, `${f} sem exigirModulo`)
      total++
    }
  }
  assert.ok(total >= 6)
})
const CONTEUDO_DE_MODULO = {
  '/zona1': /Painel da zona 1|recursos no seu escopo/,
  '/zona1/relatorios': /Relatórios|com custo/,
  '/zona2': /Conferir inventário|Revisar cadastro|Concluir e ir/,
  '/acesso': /Zonas registradas|Módulos: restrição/,
  // o auditor_shell_3 voltou o fail-open só no detalhe do recurso e tudo ficou verde (V1)
  '/zona1/recursos/r-1': /Identificador:|CC-10/,
}

test('L1 cobre toda pagina de modulo das zonas: pagina nova sem entrada aqui reprova', () => {
  // O shell fica de fora de proposito: a pagina dele chama modulosPermitidos() de novo e lanca
  // com a gestao de acesso fora (equivalencia provada pelo auditor_shell_3).
  const paginas = (d) => readdirSync(d).flatMap((n) => {
    const p = join(d, n)
    if (n === '(publico)') return []
    return statSync(p).isDirectory() ? paginas(p) : n === 'page.tsx' ? [p] : []
  })
  for (const app of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const raizApp = join(RAIZ, app, 'app')
    for (const f of paginas(raizApp)) {
      const rota = '/' + f.slice(raizApp.length + 1).split('/').slice(0, -1).filter((s) => !/^\(.*\)$/.test(s)).join('/')
      const padrao = new RegExp('^' + rota.replace(/\[[^\]]+\]/g, '[^/]+') + '$')
      assert.ok(Object.keys(CONTEUDO_DE_MODULO).some((c) => padrao.test(c)), `${rota} (${app}) sem entrada em CONTEUDO_DE_MODULO`)
    }
  }
})
