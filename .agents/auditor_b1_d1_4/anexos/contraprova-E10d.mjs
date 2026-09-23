import { subir } from '../../../base/scripts/ambiente.mjs'
import { pedir, entrar } from '../../../base/verificacao/apoio.mjs'
const amb = await subir({ construir: false })
try {
  const bruno = (await entrar('bruno')).cookie
  const html = (await pedir('/zona1', { cookie: bruno })).html
  console.log('contraprova E10d (codigo limpo): bruno /zona1 HTML contem CC-10?', html.includes('CC-10'), '| status ok:', /Painel da zona 1/.test(html))
} finally { amb.derrubar() }
