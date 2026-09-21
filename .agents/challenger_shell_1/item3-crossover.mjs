import { readFileSync } from 'node:fs'
const PID = Number(process.argv[2])
const cookie = readFileSync('cookies/carla.txt', 'utf8')
  .split('\n').find((l) => l.includes('__Host-session'))?.split('\t').pop()?.trim()

async function probe() {
  const r = await fetch('http://localhost:3000/acesso', { headers: { Cookie: `__Host-session=${cookie}` }, redirect: 'manual' })
  await r.text()
  return r.status
}
console.log('sonda inicial:', await probe())

const tMorte = Date.now()
process.kill(PID, 'SIGTERM')

const registros = []
for (let i = 0; i < 200; i++) {
  const t0 = Date.now()
  const r = await fetch('http://localhost:3000/acesso', { headers: { Cookie: `__Host-session=${cookie}` }, redirect: 'manual' })
  const corpo = await r.text()
  registros.push({ i, status: r.status, msDesdeMorte: Date.now() - tMorte, tamanho: corpo.length })
  if (r.status === 503 && registros.filter(x=>x.status===503).length >= 3) break
}
const n500 = registros.filter(r => r.status !== 503).length
const primeiro503 = registros.find(r => r.status === 503)
console.log(JSON.stringify({ tMorte, n500, primeiro503, ultimoNao503: registros.filter(r=>r.status!==503).at(-1), registros }, null, 2))
