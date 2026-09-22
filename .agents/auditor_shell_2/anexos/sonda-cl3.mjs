import { connect } from 'node:net'
import { execSync } from 'node:child_process'
import { subir } from './scripts/ambiente.mjs'
import { entrar } from './verificacao/apoio.mjs'
const amb = await subir({})
const pidShell = () => execSync("ss -ltnpH 'sport = :3000'").toString().match(/pid=(\d+)/)[1]
const rss = () => Number(execSync(`ps -o rss= -p ${pidShell()}`).toString().trim())
try {
  const davi = (await entrar('davi')).cookie
  const enviar = (mb, comCL) => new Promise((ok) => {
    const t0 = Date.now(); const n = mb * 1024 * 1024
    const s = connect(3000, '127.0.0.1', async () => {
      s.write(`POST /api/otel/v1/traces HTTP/1.1\r\nHost: localhost:3000\r\nCookie: ${davi}\r\nContent-Type: application/json\r\n` + (comCL ? `Content-Length: ${n}\r\n\r\n` : 'Transfer-Encoding: chunked\r\n\r\n'))
      const pedaco = Buffer.alloc(1024 * 1024, 120)
      for (let i = 0; i < mb && !s.destroyed; i++) {
        const b = comCL ? pedaco : Buffer.concat([Buffer.from(pedaco.length.toString(16) + '\r\n'), pedaco, Buffer.from('\r\n')])
        if (!s.write(b)) await new Promise((r) => s.once('drain', r))
      }
      if (!comCL && !s.destroyed) s.write('0\r\n\r\n')
    })
    let buf = ''
    s.on('data', (d) => { buf += d; const m = buf.match(/^HTTP\/1\.1 (\d{3})/); if (m) { ok(`${m[1]} em ${Date.now() - t0} ms`); s.destroy() } })
    s.on('error', (e) => ok('erro ' + e.code + ' em ' + (Date.now() - t0) + ' ms'))
    setTimeout(() => { ok('sem resposta em 20 s'); s.destroy() }, 20000)
  })
  for (const [mb, cl] of [[1, false], [5, false], [9, false], [11, false], [20, false], [1, true], [20, true]]) {
    const antes = rss(); const r = await enviar(mb, cl); const depois = rss()
    console.log(`${mb} MB ${cl ? 'com Content-Length' : 'chunked'}: ${r}; RSS do shell ${Math.round(antes/1024)} -> ${Math.round(depois/1024)} MB`)
  }
} finally { amb.derrubar() }
