// Zona de teste mínima (C3): um servidor HTTP do Node que responde por um prefixo e registra a própria rota na
// gestão de acesso, como uma zona de verdade faz no deploy (`scripts/registrar-rota.ts`). Não tem sessão, módulo
// nem manifesto: o shell só confere o cookie (camada 1) e roteia; o que a verificação quer provar é o roteamento.
//
// Páginas:
//   /{id}                       documento simples, com uma marca no corpo
//   /{id}/api/health            sonda de saúde do shell
//   /{id}/lenta-em-sequencia    N chamadas lentas em sequência (cada uma abaixo do timeout de destino) antes de
//                               mandar qualquer byte, como uma página que espera vários domínios lentos (L9b)
//   /{id}/trava-no-meio         manda os cabeçalhos e o primeiro pedaço e para (L9c)
//   /{id}/_lento?ms=N           o "domínio lento" que a página acima chama
import { createServer, request } from 'node:http'

const ACESSO_URL = process.env.ACESSO_URL ?? 'http://127.0.0.1:4020'

/**
 * Sobe a zona `id` na `porta`, ouvindo em cada host de `hosts`. Devolve o registro das requisições recebidas
 * (`recebidas`: caminho, host local e quando a conexão fechou) e as funções de registro de rota.
 */
export async function subirZonaDeTeste({ id = 'zona9', porta = 3009, hosts = ['127.0.0.1'] } = {}) {
  const recebidas = []
  const marca = `zona de teste ${id}`
  const tratar = (req, res) => {
    const u = new URL(req.url, 'http://x')
    const reg = { caminho: u.pathname, host: req.socket.localAddress, inicio: Date.now(), fechouEm: null }
    recebidas.push(reg)
    res.on('close', () => { reg.fechouEm = Date.now() })
    // a zona descobre o prefixo pelo primeiro segmento: a mesma zona responde por outro id (L11)
    const [, prefixo, ...resto] = u.pathname.split('/')
    const sub = resto.join('/')
    if (sub === 'api/health') return res.end('ok')
    if (sub === '_lento') return setTimeout(() => res.end('ok'), Number(u.searchParams.get('ms') ?? 1000))
    if (sub === 'lenta-em-sequencia') {
      const passos = Number(u.searchParams.get('passos') ?? 3)
      const ms = Number(u.searchParams.get('ms') ?? 2500)
      let feitos = 0
      const proxima = () => {
        if (res.destroyed) return
        if (feitos === passos) {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
          return res.end(`<html><body>${marca}: ${feitos} chamadas</body></html>`)
        }
        const r = request(`http://127.0.0.1:${porta}/${prefixo}/_lento?ms=${ms}`, (rr) => { rr.resume(); rr.on('end', () => { feitos++; proxima() }) })
        r.on('error', () => res.destroy())
        r.end()
      }
      return proxima()
    }
    if (sub === 'trava-no-meio') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.write(`<html><body>${marca}: primeiro pedaco`)
      return // para aqui; a conexão fica aberta até alguém fechar
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<html><body><p>${marca}</p><p>${prefixo}/${sub}</p></body></html>`)
  }
  const servidores = []
  for (const host of hosts) {
    const s = createServer(tratar)
    await new Promise((ok, falha) => { s.once('error', falha); s.listen(porta, host, ok) })
    servidores.push(s)
  }

  /** `POST`/`DELETE {ACESSO_URL}/v2/zonas/{id}/rota` com `svc.{id}`, como o script de deploy da zona. */
  const rota = (metodo, idDaRota = id, origem = `http://127.0.0.1:${porta}`) => fetch(`${ACESSO_URL}/v2/zonas/${idDaRota}/rota`, {
    method: metodo,
    headers: { authorization: `Bearer svc.${idDaRota}`, 'content-type': 'application/json' },
    body: metodo === 'POST' ? JSON.stringify({ origem }) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.status)

  return {
    id, porta, marca, recebidas,
    registrar: (idDaRota, origem) => rota('POST', idDaRota, origem),
    remover: (idDaRota) => rota('DELETE', idDaRota),
    fechar: () => Promise.all(servidores.map((s) => new Promise((ok) => { s.closeAllConnections(); s.close(ok) }))),
  }
}
