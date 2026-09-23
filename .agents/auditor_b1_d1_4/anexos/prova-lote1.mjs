// Prova do efeito das mutações do LOTE1 com a base no ar (auditor_b1_d1_4).
import { createServer } from 'node:http'
import { execSync } from 'node:child_process'
import { subir, RAIZ } from '../../../base/scripts/ambiente.mjs'
import { pedir, entrar } from '../../../base/verificacao/apoio.mjs'
const hits = []
const alvo = createServer((req, res) => { hits.push(req.url); res.end('ok') })
alvo.on('upgrade', (req, sock) => { hits.push('upgrade ' + req.url); sock.destroy() })
await new Promise((ok) => alvo.listen(4999, '127.0.0.1', ok))
const amb = await subir({ construir: false })
try {
  const bruno = (await entrar('bruno')).cookie
  const html = (await pedir('/zona1', { cookie: bruno })).html
  const rsc = (await pedir('/zona1', { cookie: bruno, cabecalhos: { rsc: '1' } })).html
  console.log('E10d: bruno /zona1 HTML contem CC-10 (custo nao renderizado na pagina)?', html.includes('CC-10'), '| RSC contem CC-10?', rsc.includes('CC-10'), '| trecho:', (rsc.match(/.{0,60}CC-10.{0,40}/) ?? [''])[0])
  const ana = (await entrar('ana')).cookie
  await pedir('/zona2', { cookie: ana })
  const carla = (await entrar('carla')).cookie
  await pedir('/acesso', { cookie: carla })
  await new Promise((ok) => setTimeout(ok, 1500))
  console.log('XR20p/XR38p/XR23p: pedidos recebidos no alvo externo 4999:', JSON.stringify([...new Set(hits)]))
  const chunks = execSync(`grep -rl '127.0.0.1:4003' ${RAIZ}/erp-zona-2/.next/static || true`).toString().trim()
  console.log('XN01p: endpoint interno do dominio C no bundle do NAVEGADOR da zona 2:', chunks || '(nenhum)')
} finally {
  amb.derrubar(); alvo.close()
}
