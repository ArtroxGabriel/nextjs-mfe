import { readFileSync } from 'node:fs'

const PID_ZONA2 = Number(process.argv[2])
const cookie = readFileSync('cookies/ana.txt', 'utf8')
  .split('\n')
  .find((l) => l.includes('__Host-session'))
  ?.split('\t')
  .pop()
  ?.trim()

const N = 40

async function probe() {
  const r = await fetch('http://localhost:3000/zona2', {
    headers: { Cookie: `__Host-session=${cookie}` },
    redirect: 'manual',
  })
  await r.text()
  return r.status
}

const s0 = await probe()
console.log('sonda inicial status=', s0, 'em', Date.now())

const tMorte = Date.now()
process.kill(PID_ZONA2, 'SIGTERM')

const promessas = Array.from({ length: N }, async (_, i) => {
  const t0 = Date.now()
  try {
    const r = await fetch('http://localhost:3000/zona2', {
      headers: { Cookie: `__Host-session=${cookie}` },
      redirect: 'manual',
    })
    const corpo = await r.text()
    return { i, status: r.status, msDesdeMorte: Date.now() - tMorte, contentType: r.headers.get('content-type'), tamanho: corpo.length, trecho: corpo.slice(0, 80) }
  } catch (e) {
    return { i, erro: String(e), msDesdeMorte: Date.now() - tMorte }
  }
})
const resultados = await Promise.all(promessas)
console.log(JSON.stringify({ tMorte, resultados }, null, 2))
