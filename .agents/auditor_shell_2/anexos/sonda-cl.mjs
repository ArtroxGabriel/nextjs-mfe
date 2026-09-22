import { connect } from 'node:net'
import { subir } from './scripts/ambiente.mjs'
import { entrar } from './verificacao/apoio.mjs'
const amb = await subir({})
try {
  const davi = (await entrar('davi')).cookie
  const bruto = (cl, corpo, ms = 4000) => new Promise((ok) => {
    const t0 = Date.now()
    const s = connect(3000, '127.0.0.1', () => { s.write(`POST /api/otel/v1/traces HTTP/1.1\r\nHost: localhost:3000\r\nCookie: ${davi}\r\nContent-Type: application/json\r\nContent-Length: ${cl}\r\n\r\n`); if (corpo) s.write(corpo) })
    let buf = ''
    s.on('data', (d) => { buf += d; const m = buf.match(/^HTTP\/1\.1 (\d{3})/); if (m) { ok(`${m[1]} em ${Date.now() - t0} ms`); s.destroy() } })
    s.on('error', (e) => ok('erro ' + e.code))
    setTimeout(() => { ok(`sem resposta em ${ms} ms`); s.destroy() }, ms)
  })
  console.log('CL 10MB, sem corpo:', await bruto(10_000_000, ''))
  console.log('CL 300KB, 1 KB de corpo:', await bruto(300_000, 'x'.repeat(1024)))
  console.log('CL 2, corpo {}:', await bruto(2, '{}'))
  console.log('CL 10MB, 300 KB de corpo:', await bruto(10_000_000, 'x'.repeat(300_000)))
} finally { amb.derrubar() }
