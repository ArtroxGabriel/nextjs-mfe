import { createServer } from 'node:http'
createServer((req, res) => {
  const u = req.url
  if (u.startsWith('/zona2/api/health')) { res.end('ok'); return }
  if (u.startsWith('/zona2/stream')) { // 5 pedacos, 1 a cada 2 s = 10 s total, > teto 6 s
    res.writeHead(200, { 'content-type': 'text/plain' }); let i = 0
    const t = setInterval(() => { res.write(`pedaco ${i++}\n`); if (i === 5) { clearInterval(t); res.end('fim\n') } }, 2000); res.on('close', () => clearInterval(t)); return
  }
  if (u.startsWith('/zona2/trava')) { res.writeHead(200, { 'content-type': 'text/plain' }); res.write('inicio\n'); return } // cabecalho + 1 pedaco, depois silencio
  if (u.startsWith('/zona2/cabecalho-tardio')) { setTimeout(() => res.end('tarde'), 9000); return } // silencio total 9 s
  if (u.startsWith('/zona2/lento-ok')) { setTimeout(() => res.end('ok lento'), 4000); return } // silencio 4 s < teto
  res.statusCode = 404; res.end('x')
}).listen(3002, '127.0.0.1')
