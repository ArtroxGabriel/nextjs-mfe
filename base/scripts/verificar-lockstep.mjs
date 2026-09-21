// Lockstep do núcleo (desenho/mfe/01-operacao §7.2): toda aplicação usa a MESMA versão de
// @erp/nucleo, no package.json e no lockfile. Dois núcleos no mesmo produto são duas
// allowlists e dois contratos de erro — falha de segurança, não inconsistência estética.
// Substitui o deploy atômico que o multi-repo descartou.
//   node base/scripts/verificar-lockstep.mjs      (também roda no hook .githooks/pre-push)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ, APPS } from './ambiente.mjs'

export function versoesDoNucleo(raiz = RAIZ, apps = APPS.map((a) => a.dir)) {
  return apps.map((dir) => {
    const pkg = JSON.parse(readFileSync(join(raiz, dir, 'package.json'), 'utf8'))
    const lock = readFileSync(join(raiz, dir, 'pnpm-lock.yaml'), 'utf8')
    const travada = lock.match(/'@erp\/nucleo':\s*\n\s*specifier:\s*(\S+)\s*\n\s*version:\s*([0-9][^\s(]*)/)
    return { dir, declarada: pkg.dependencies?.['@erp/nucleo'] ?? null, travada: travada?.[2] ?? null }
  })
}

export function divergencias(versoes) {
  const erros = []
  for (const v of versoes) {
    if (!v.declarada) erros.push(`${v.dir}: nao depende de @erp/nucleo`)
    else if (!/^\d+\.\d+\.\d+$/.test(v.declarada)) erros.push(`${v.dir}: versao nao exata (${v.declarada}); lockstep exige versao fixa`)
    if (v.declarada && v.travada && v.declarada !== v.travada) erros.push(`${v.dir}: package.json diz ${v.declarada}, lockfile trava ${v.travada}`)
  }
  const distintas = new Set(versoes.map((v) => v.travada ?? v.declarada))
  if (distintas.size > 1) erros.push(`versoes diferentes entre as aplicacoes: ${versoes.map((v) => `${v.dir}=${v.travada ?? v.declarada}`).join(', ')}`)
  return erros
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const versoes = versoesDoNucleo()
  const erros = divergencias(versoes)
  if (erros.length) {
    console.error('Lockstep do nucleo quebrado:'); for (const e of erros) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log(`lockstep ok: @erp/nucleo ${versoes[0].travada} em ${versoes.length} aplicacoes`)
}
