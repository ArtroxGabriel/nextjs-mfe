// Roda um lote (array de specs do mut.mjs), uma mutação por vez, e para se a restauração falhar.
// Uso: node .agents/auditor_b1_d1_8/anexos/lote.mjs <lote.json> [id ...]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const specs = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const so = process.argv.slice(3)
const dir = mkdtempSync(join(tmpdir(), 'aud8-'))
for (const s of specs) {
  if (so.length && !so.includes(s.id)) continue
  const f = join(dir, `${s.id}.json`)
  writeFileSync(f, JSON.stringify(s))
  const r = spawnSync('node', [new URL('./mut.mjs', import.meta.url).pathname, f], { stdio: 'inherit' })
  if (r.status === 3) { console.error('restauracao falhou; parando'); process.exit(3) }
  if (r.status !== 0) console.error(`${s.id}: executor saiu com ${r.status}`)
}
