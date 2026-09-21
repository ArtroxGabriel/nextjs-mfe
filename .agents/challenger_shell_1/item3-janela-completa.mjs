import { readFileSync } from 'node:fs'
const cookie = readFileSync('cookies/ana.txt', 'utf8')
  .split('\n').find((l) => l.includes('__Host-session'))?.split('\t').pop()?.trim()

const inicio = Date.now()
let contagem500 = 0
let primeiroDe503 = null
const registros = []
for (let i = 0; i < 300; i++) {
  const t0 = Date.now()
  const r = await fetch('http://localhost:3000/zona2', { headers: { Cookie: `__Host-session=${cookie}` }, redirect: 'manual' })
  await r.text()
  const ms = Date.now() - inicio
  registros.push({ i, status: r.status, msDesdeMorte: ms })
  if (r.status === 500) contagem500++
  if (r.status === 503 && primeiroDe503 === null) primeiroDe503 = ms
  if (r.status === 503 && i > 5) break // ja estabilizou
}
console.log(JSON.stringify({ contagem500, primeiro503MsDesdeMorte: primeiroDe503, totalAmostras: registros.length, registros }, null, 2))
