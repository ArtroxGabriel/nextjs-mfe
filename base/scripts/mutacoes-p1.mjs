import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { executarAsync } from './pnpm-auth-fixture.mjs'

export function substituirUnico(fonte, antes, depois) {
  if (fonte.split(antes).length !== 2) throw new Error(`marcador nao e unico: ${antes}`)
  return fonte.replace(antes, depois)
}
export function mutarIntegridadeVerificar(fonte) {
  const inicio = fonte.indexOf('export async function verificar(')
  const fim = fonte.indexOf('export async function migrarRegistro(', inicio)
  if (inicio < 0 || fim < 0) throw new Error('verificar nao encontrada')
  return fonte.slice(0, inicio) + substituirUnico(fonte.slice(inicio, fim), ' || meta.dist?.integrity !== integrity', '') + fonte.slice(fim)
}
const pacotes = 'base/scripts/pacotes.mjs'
export const mutacoes = [
  { id: 'M1', arquivo: pacotes, antes: 'if (meta) throw new Error(`${pkg.name}@${pkg.version} ja publicado;', depois: 'if (false) throw new Error(`${pkg.name}@${pkg.version} ja publicado;' },
  { id: 'M2', arquivo: pacotes, antes: 'if (resposta.status === 404)', depois: 'if ([404, 401, 500].includes(resposta.status))' },
  { id: 'M3', arquivo: pacotes, transformar: mutarIntegridadeVerificar },
  { id: 'M4', arquivo: pacotes, antes: "redirect: 'manual'", depois: "redirect: 'follow'" },
  { id: 'M5', arquivo: pacotes, antes: "(url.protocol === 'http:' && loopback)", depois: "(url.protocol === 'http:')" },
  { id: 'M6', arquivo: pacotes, antes: "'install', '--frozen-lockfile',", depois: "'install'," },
  { id: 'M7', arquivo: pacotes, antes: "['publish', tarball,", depois: "['publish', origem," },
  { id: 'M8', arquivo: 'repos/erp-shell/package.json', transformar: (s) => {
    const pkg = JSON.parse(s)
    for (const nome of ['build', 'start']) pkg.scripts[nome] = 'ERP_PERMITIR_IDENTIDADE_DEV=1 ' + pkg.scripts[nome]
    return JSON.stringify(pkg, null, 2)
  } },
  { id: 'M9', arquivo: 'repos/erp-shell/lib/configuracao.ts', antes: "if (env.NODE_ENV === 'production' && !env.IDP_EMISSOR?.trim() && env.ERP_PERMITIR_IDENTIDADE_DEV !== '1')", depois: 'if (false)' },
  { id: 'M10', arquivo: 'base/scripts/verificar-lockstep.mjs', antes: 'if (!v.travada) erros.push', depois: 'if (false) erros.push' },
]
const alvo = (id) => id === 'M6' ? ['base/scripts/pacotes.test.mjs', 'base/scripts/pnpm-auth.test.mjs'] : id === 'M10' ? ['base/scripts/verificar-lockstep.test.mjs'] : ['base/scripts/pacotes.test.mjs']
async function rodarTeste(copia, id) {
  const shell = ['M8', 'M9'].includes(id)
  return executarAsync(process.execPath, ['--conditions', 'react-server', '--test', ...(shell ? ['test/configuracao.test.mjs'] : alvo(id))], {
    cwd: shell ? join(copia, 'repos/erp-shell') : copia,
  })
}
export async function executarMutacoes(destino, raiz = resolve(fileURLToPath(new URL('../..', import.meta.url)))) {
  mkdirSync(destino, { recursive: true })
  const copia = mkdtempSync(join(destino, 'mutacoes-isoladas-'))
  const resultados = []
  try {
    cpSync(join(raiz, 'base/scripts'), join(copia, 'base/scripts'), { recursive: true })
    for (const repo of ['erp-contratos', 'erp-nucleo', 'erp-moldura', 'erp-dominio-stub', 'erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
      mkdirSync(join(copia, 'repos', repo), { recursive: true })
      for (const arquivo of ['package.json', 'pnpm-lock.yaml']) cpSync(join(raiz, 'repos', repo, arquivo), join(copia, 'repos', repo, arquivo))
    }
    for (const arquivo of ['lib/configuracao.ts', 'test/configuracao.test.mjs']) {
      mkdirSync(join(copia, 'repos/erp-shell', arquivo.split('/')[0]), { recursive: true })
      cpSync(join(raiz, 'repos/erp-shell', arquivo), join(copia, 'repos/erp-shell', arquivo))
    }
    for (const id of ['M1', 'M6', 'M8', 'M10']) {
      const base = await rodarTeste(copia, id)
      writeFileSync(join(destino, `baseline-${id}.log`), base.output)
      if (base.code !== 0) throw new Error(`baseline ${id} reprovou; nao atribuir a mutacao`)
    }
    for (const m of mutacoes) {
      const arquivo = join(copia, m.arquivo)
      const fonte = readFileSync(arquivo, 'utf8')
      try {
        writeFileSync(arquivo, m.transformar ? m.transformar(fonte) : substituirUnico(fonte, m.antes, m.depois))
        const r = await rodarTeste(copia, m.id)
        writeFileSync(join(destino, `${m.id}.log`), r.output)
        resultados.push({ id: m.id, resultado: r.code === 0 ? 'sobreviveu' : 'pegou', code: r.code,
          testes: r.output.split('\n').filter((l) => l.startsWith('✖ ') && !l.startsWith('✖ failing')) })
      } finally { writeFileSync(arquivo, fonte) }
    }
    writeFileSync(join(destino, 'resultados.json'), JSON.stringify(resultados, null, 2) + '\n')
    return resultados
  } finally { rmSync(copia, { recursive: true, force: true }) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('informe diretorio de logs')
  const resultados = await executarMutacoes(resolve(process.argv[2]))
  console.log(JSON.stringify(resultados, null, 2))
  if (resultados.some((r) => r.resultado === 'sobreviveu')) process.exitCode = 1
}
