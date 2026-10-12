import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { executarAsync } from './pnpm-auth-fixture.mjs'
import { substituirUnico } from './mutacoes-p1.mjs'

const destino = resolve(process.argv[2] ?? process.env.P1_SCRATCH ?? '')
if (!process.argv[2] && !process.env.P1_SCRATCH) throw new Error('informe diretorio de logs')
const copia = mkdtempSync(join(destino, 'prova-espera-'))
const nucleo = resolve('repos/erp-nucleo')
try {
  for (const dir of ['test', 'dist']) cpSync(join(nucleo, dir), join(copia, dir), { recursive: true })
  cpSync(join(nucleo, 'package.json'), join(copia, 'package.json'))
  symlinkSync(join(nucleo, 'node_modules'), join(copia, 'node_modules'))
  const arquivo = join(copia, 'dist/fabricas/criarNucleo.js')
  const fonte = readFileSync(arquivo, 'utf8')
  for (const [id, valor] of [['baseline', 'esperaMs'], ['antes-do-teto', '0'], ['depois-do-teto', 'esperaMs + 20']]) {
    writeFileSync(arquivo, substituirUnico(fonte, 'const limite = Date.now() + esperaMs;', `const limite = Date.now() + ${valor};`))
    const r = await executarAsync(process.execPath, ['--conditions', 'react-server', '--test', '--test-name-pattern=relogio controlado', 'test/identidade.test.mjs'], { cwd: copia })
    writeFileSync(join(destino, `espera-prova-${id}.log`), r.output)
    console.log(JSON.stringify({ id, code: r.code }))
    if ((id === 'baseline' && r.code !== 0) || (id !== 'baseline' && r.code === 0)) throw new Error(`prova falhou: ${id}`)
  }
} finally { rmSync(copia, { recursive: true, force: true }) }
