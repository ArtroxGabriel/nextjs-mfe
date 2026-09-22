// Alinha as linhas `integrity` dos pacotes @erp/* nos lockfiles ao Verdaccio DESTA máquina.
// Cada máquina tem o próprio Verdaccio e `npm pack` não é reproduzível: o mesmo commit
// publicado em duas máquinas gera dois hashes (ADR-0010, AMBIENTE.md §1).
//
// Só use depois de conferir que o pacote publicado aqui saiu do MESMO commit que o da outra
// máquina (`git -C repos/erp-<pacote> log`); conteúdo diferente não se resolve trocando hash.
// A troca é local: esses lockfiles NÃO entram em commit.
//   node base/scripts/alinhar-hashes.mjs          (task pacotes:alinhar-hashes)
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ } from './ambiente.mjs'

const REGISTRO = 'http://localhost:4873'
const REPOS = ['erp-nucleo', 'erp-moldura', 'erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso', 'erp-dominio-stub']

/** Pacotes @erp/* resolvidos no lockfile, com o hash gravado. */
export function pacotesErp(lock) {
  const re = /\n {2}'(@erp\/[a-z-]+)@([0-9][^']*)':\n {4}resolution: \{integrity: ([^,}]+)/g
  return [...lock.matchAll(re)].map(([, nome, versao, integrity]) => ({ nome, versao, integrity }))
}

/** Troca o hash de `nome@versao` por `novo`; devolve o texto inalterado se não achar. */
export function trocarIntegrity(lock, nome, versao, novo) {
  const chave = `\n  '${nome}@${versao}':\n    resolution: {integrity: `
  const i = lock.indexOf(chave)
  if (i < 0) return lock
  const inicio = i + chave.length
  const fim = lock.slice(inicio).search(/[,}]/) + inicio
  return lock.slice(0, inicio) + novo + lock.slice(fim)
}

async function hashLocal(nome, versao) {
  const r = await fetch(`${REGISTRO}/${nome.replace('/', '%2F')}`, { signal: AbortSignal.timeout(5000) })
  if (!r.ok) return null
  return (await r.json()).versions?.[versao]?.dist?.integrity ?? null
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let faltando = 0
  for (const repo of REPOS) {
    const arquivo = join(RAIZ, repo, 'pnpm-lock.yaml')
    let lock = readFileSync(arquivo, 'utf8')
    for (const { nome, versao, integrity } of pacotesErp(lock)) {
      const novo = await hashLocal(nome, versao)
      if (!novo) { console.log(`${repo}: ${nome}@${versao} não está no Verdaccio local — publique antes`); faltando++; continue }
      if (novo === integrity) continue
      lock = trocarIntegrity(lock, nome, versao, novo)
      console.log(`${repo}: ${nome}@${versao} alinhado ao Verdaccio local`)
    }
    writeFileSync(arquivo, lock)
  }
  process.exit(faltando ? 1 : 0)
}
