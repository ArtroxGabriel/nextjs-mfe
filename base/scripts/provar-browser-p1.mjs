import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { executarAsync } from './pnpm-auth-fixture.mjs'
import { substituirUnico } from './mutacoes-p1.mjs'

if (!process.argv[2]) throw new Error('informe diretorio de logs')
const destino = resolve(process.argv[2])
const copia = mkdtempSync(join(destino, 'prova-browser-'))
try {
  for (const nome of ['navegador.mjs', 'navegador.test.mjs']) cpSync(resolve('base/verificacao', nome), join(copia, nome))
  const arquivo = join(copia, 'navegador.mjs')
  const fonte = readFileSync(arquivo, 'utf8')
  for (const id of ['baseline', 'sem-aba']) {
    writeFileSync(arquivo, id === 'baseline' ? fonte : substituirUnico(fonte, "'--remote-debugging-address=127.0.0.1', 'about:blank'", "'--remote-debugging-address=127.0.0.1'"))
    const r = await executarAsync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', '--test-name-pattern=o navegador navega', 'navegador.test.mjs'], {
      cwd: copia, env: { ...process.env, ERP_CHROME: 'docker' },
    })
    writeFileSync(join(destino, `browser-prova-${id}.log`), r.output)
    console.log(JSON.stringify({ id, code: r.code }))
    if ((id === 'baseline' && r.code !== 0) || (id !== 'baseline' && r.code === 0)) throw new Error(`prova falhou: ${id}`)
  }
} finally { rmSync(copia, { recursive: true, force: true }) }
