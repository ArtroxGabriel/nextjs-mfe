// Estado gravado dos domínios falsos do showcase (DADOS_DIR) contra a semente do stub.
// O estado nasce de uma cópia da semente e não acompanha mudanças nela: uma pessoa que a semente ganhou depois
// (a eva, por exemplo) não existe no estado de quem já usava o showcase, e o login dela falha sem explicação.
// `task showcase` avisa e sugere `task showcase:dados:resetar`, que volta o estado à semente. Não migra: o estado
// pode ter mudanças feitas de propósito na tela de gestão de acesso, e só quem as fez decide descartá-las.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ } from './ambiente.mjs'

export const SEMENTE_DIR = join(RAIZ, 'erp-dominio-stub', 'dados', 'semente')

const logins = (dados) => new Set((Array.isArray(dados?.pessoas) ? dados.pessoas : []).map((p) => p?.login).filter(Boolean))

/**
 * Pessoas da semente (por `login`) que faltam no estado gravado, por arquivo. Arquivo que ainda não foi gravado
 * não conta (o domínio parte da semente). Estado ilegível vira `{ arquivo, ilegivel: true }`.
 */
export function atoresAusentes(dadosDir, sementeDir = SEMENTE_DIR) {
  if (!dadosDir || !existsSync(dadosDir)) return []
  const achados = []
  for (const arquivo of readdirSync(sementeDir).filter((n) => n.endsWith('.json')).sort()) {
    const caminho = join(dadosDir, arquivo)
    if (!existsSync(caminho)) continue
    const daSemente = logins(JSON.parse(readFileSync(join(sementeDir, arquivo), 'utf8')))
    if (daSemente.size === 0) continue
    let gravados
    try { gravados = logins(JSON.parse(readFileSync(caminho, 'utf8'))) } catch { achados.push({ arquivo, ilegivel: true }); continue }
    const faltam = [...daSemente].filter((l) => !gravados.has(l))
    if (faltam.length) achados.push({ arquivo, faltam })
  }
  return achados
}

/** Texto do aviso para o terminal, ou `null` quando o estado tem todos os atores da semente. */
export function avisoDeEstado(achados, dadosDir) {
  if (achados.length === 0) return null
  const linhas = achados.map((a) => a.ilegivel ? `    ${a.arquivo}: ilegivel` : `    ${a.arquivo}: faltam ${a.faltam.join(', ')}`)
  return [
    `AVISO: o estado gravado dos dominios (${dadosDir}) e anterior a semente atual:`,
    ...linhas,
    '  Esses atores nao conseguem entrar. Para voltar a semente (apaga o que foi mudado na tela de acesso):',
    '    task showcase:dados:resetar   (com o showcase parado; depois, task showcase de novo)',
  ].join('\n')
}
