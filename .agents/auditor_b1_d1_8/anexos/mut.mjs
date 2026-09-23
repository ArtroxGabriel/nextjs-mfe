// Executor de mutações do auditor_b1_d1_8.
// Uso: node .agents/auditor_b1_d1_8/anexos/mut.mjs <spec.json>
// spec: { id, inv, desc, cmd, cwd?, env?, edicoes: [{ arquivo, de, para, todas?, novo? }] }
// Aplica cada edição por TEXTO EXATO (de tem de ocorrer; uma vez, salvo `todas`), roda `cmd`, registra
// a linha em mutacoes.txt e o log em anexos/lote/<id>.log, restaura byte a byte e confere.
import { readFileSync, writeFileSync, existsSync, unlinkSync, appendFileSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'

const RAIZ = new URL('../../../', import.meta.url).pathname
const AUD = join(RAIZ, '.agents', 'auditor_b1_d1_8')
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'))
mkdirSync(join(AUD, 'anexos', 'lote'), { recursive: true })

const DADOS = join(RAIZ, 'repos', 'erp-dominio-stub', 'dados')
const copiaDados = join(AUD, 'anexos', '.dados-antes')
rmSync(copiaDados, { recursive: true, force: true })
cpSync(DADOS, copiaDados, { recursive: true })

const originais = new Map()
try {
  for (const e of spec.edicoes) {
    const p = join(RAIZ, e.arquivo)
    if (e.novo) {
      if (existsSync(p)) throw new Error(`${e.arquivo} ja existe`)
      originais.set(p, null)
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, e.para)
      continue
    }
    const t = originais.has(p) ? readFileSync(p, 'utf8') : readFileSync(p, 'utf8')
    if (!originais.has(p)) originais.set(p, t)
    const n = t.split(e.de).length - 1
    if (n === 0) throw new Error(`${spec.id}: trecho nao encontrado em ${e.arquivo}: ${e.de.slice(0, 80)}`)
    if (n > 1 && !e.todas) throw new Error(`${spec.id}: trecho ocorre ${n}x em ${e.arquivo}`)
    writeFileSync(p, e.todas ? t.split(e.de).join(e.para) : t.replace(e.de, () => e.para))
  }
  const r = spawnSync('bash', ['-lc', spec.cmd], { cwd: join(RAIZ, spec.cwd ?? '.'), env: { ...process.env, ...(spec.env ?? {}) }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: spec.timeout ?? 1_500_000 })
  const saida = (r.stdout ?? '') + (r.stderr ?? '')
  writeFileSync(join(AUD, 'anexos', 'lote', `${spec.id}.log`), saida)
  const soma = (rot) => [...saida.matchAll(new RegExp(`ℹ ${rot} (\\d+)`, 'g'))].reduce((a, m) => a + Number(m[1]), 0)
  const tests = soma('tests'), pass = soma('pass'), fail = soma('fail'), skipped = soma('skipped')
  const falhas = [...new Set([...saida.matchAll(/^\s*✖ (.+?)(?: \(\d[\d.]*ms\))?$/gm)].map((m) => m[1].trim())
    .filter((n) => !/^(failing tests:|.*\.test\.mjs)$/.test(n)))]
  const morto = fail > 0 || (tests === 0 && r.status !== 0)
  const ev = tests === 0 ? `saida ${r.status}: ${saida.trim().split('\n').slice(-3).join(' / ').slice(0, 300)}`
    : `${pass}/${tests}${skipped ? ` (+${skipped} pulados)` : ''}${fail ? `; reprovou: ${falhas.slice(0, 4).join(' ; ').slice(0, 400)}` : ''}`
  const linha = `${spec.id} | ${spec.edicoes.map((e) => e.arquivo).join(' + ')} | ${spec.desc} | ${spec.inv} | ${morto ? 'KILLED' : 'SURVIVED'} | ${ev}`
  if (!spec.naoRegistrar) appendFileSync(join(AUD, 'mutacoes.txt'), linha + '\n')
  console.log(linha)
} finally {
  for (const [p, t] of originais) { if (t === null) unlinkSync(p); else writeFileSync(p, t) }
  // dados versionados do stub: restaura a cópia (AMBIENTE.md §3)
  rmSync(DADOS, { recursive: true, force: true })
  cpSync(copiaDados, DADOS, { recursive: true })
  rmSync(copiaDados, { recursive: true, force: true })
  for (const [p, t] of originais) {
    if (t === null ? existsSync(p) : readFileSync(p, 'utf8') !== t) { console.error(`RESTAURACAO FALHOU: ${p}`); process.exitCode = 3 }
  }
}
