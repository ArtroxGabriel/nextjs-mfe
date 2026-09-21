// Coletor OTLP falso: escuta em uma porta livre (fora da faixa 3000-3003,4001-4004,4010),
// aceita POST /v1/traces e grava cada lote recebido em coletor-log.jsonl para inspeção.
import { createServer } from 'node:http'
import { appendFileSync } from 'node:fs'

const PORTA = process.argv[2] ? Number(process.argv[2]) : 4555
const LOG = new URL('./coletor-log.jsonl', import.meta.url).pathname

const servidor = createServer((req, res) => {
  const partes = []
  req.on('data', (c) => partes.push(c))
  req.on('end', () => {
    const corpo = Buffer.concat(partes).toString('utf8')
    appendFileSync(LOG, JSON.stringify({ ts: Date.now(), metodo: req.method, url: req.url, tamanho: corpo.length }) + '\n')
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
})

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log('coletor falso ouvindo em', PORTA)
})

process.on('SIGTERM', () => process.exit(0))
