// Alvo externo das provas de saída de rede (127.0.0.1:4999): registra cada pedido em anexos/alvo.log.
import { createServer } from 'node:http'
import { appendFileSync } from 'node:fs'
const log = new URL('./alvo.log', import.meta.url).pathname
const s = createServer((req, res) => { appendFileSync(log, `${new Date().toISOString()} ${req.method} ${req.url}\n`); res.end('ok') })
s.on('upgrade', (req, sock) => { appendFileSync(log, `${new Date().toISOString()} upgrade ${req.url}\n`); sock.destroy() })
s.listen(4999, '127.0.0.1')
