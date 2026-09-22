// Navegador real para a verificação, sem instalar nada: abre o Chrome que já existe na máquina
// (Flatpak ou PATH) em modo headless e fala com ele pelo protocolo CDP, usando o WebSocket
// nativo do Node. Perfil temporário, apagado no fim.
//
// Serve para o que HTTP puro não prova: a navegação do cliente do Next (requisição RSC com a
// árvore do roteador), cookies com as regras do navegador, e o que o documento mostra.
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

// Imagem do plano B, fixada por digest (índice multi-arquitetura: amd64 e arm64), nunca `latest`.
export const IMAGEM_DOCKER = 'chromedp/headless-shell@sha256:2d349b544a1ea6b5b5fd7c0fe99215ff662339c57407ee2e8c0a11af93516b04'

const NO_PATH = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
  'microsoft-edge', 'microsoft-edge-stable', 'brave-browser']
const CAMINHOS_FIXOS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

const noPath = (b) => {
  try { return execFileSync(process.platform === 'win32' ? 'where' : 'which', [b], { encoding: 'utf8' }).split(/\r?\n/)[0].trim() || null } catch { return null }
}

/**
 * Como abrir um navegador baseado em Chromium nesta máquina, ou `null` (o teste é pulado).
 * Ordem: `ERP_CHROME` (caminho do binário, ou `docker`); binário no PATH; caminho fixo de
 * macOS/Windows; Chrome do Flatpak. Docker só quando pedido: baixa ~100 MB.
 */
export function acharChrome() {
  const forcado = process.env.ERP_CHROME
  if (forcado === 'docker') return { tipo: 'docker', imagem: process.env.ERP_CHROME_IMAGEM ?? IMAGEM_DOCKER }
  if (forcado) return { tipo: 'local', cmd: forcado, args: [], perfis: tmpdir() }
  for (const b of NO_PATH) { const cmd = noPath(b); if (cmd) return { tipo: 'local', cmd, args: [], perfis: tmpdir() } }
  for (const cmd of CAMINHOS_FIXOS) if (existsSync(cmd)) return { tipo: 'local', cmd, args: [], perfis: tmpdir() }
  try {
    execFileSync('flatpak', ['info', 'com.google.Chrome'], { stdio: 'ignore' })
    // o sandbox do Flatpak só escreve na pasta do próprio app; o perfil temporário fica lá
    const perfis = join(homedir(), '.var/app/com.google.Chrome/cache')
    mkdirSync(perfis, { recursive: true })
    return { tipo: 'local', cmd: 'flatpak', args: ['run', 'com.google.Chrome'], perfis }
  } catch { return null }
}

export const COMO_CONSEGUIR_UM_NAVEGADOR =
  'sem navegador Chromium: instale Chrome/Chromium/Edge, defina ERP_CHROME=/caminho/do/binario, ' +
  'ou use ERP_CHROME=docker (Linux; baixa a imagem chromedp/headless-shell, ~100 MB)'

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

/** Sobe o navegador e devolve a porta CDP e como encerrá-lo. */
async function lancar(chrome) {
  if (chrome.tipo === 'docker') {
    // rede do host: o container enxerga localhost:3000, e "localhost" continua sendo origem
    // segura para os cookies __Host-. Só funciona assim no Linux.
    if (process.platform !== 'linux') throw new Error('ERP_CHROME=docker so funciona no Linux (rede do host)')
    const porta = String(9300 + Math.floor(Math.random() * 600))
    const nome = `erp-verificacao-${process.pid}-${porta}`
    execFileSync('docker', ['run', '-d', '--rm', '--network', 'host', '--name', nome, chrome.imagem,
      `--remote-debugging-port=${porta}`, '--remote-debugging-address=127.0.0.1'], { stdio: 'ignore' })
    const encerrar = async () => {
      try { execFileSync('docker', ['rm', '-f', nome], { stdio: 'ignore' }) } catch { /* ja saiu */ }
      if (process.env.ERP_CHROME_DOCKER_LIMPAR === '1') {
        try { execFileSync('docker', ['rmi', chrome.imagem], { stdio: 'ignore' }) } catch { /* em uso ou ja removida */ }
      }
    }
    for (let i = 0; i < 80; i++) {
      try { await fetch(`http://127.0.0.1:${porta}/json/version`); return { porta, perfil: null, encerrar } } catch { await esperar(250) }
    }
    await encerrar(); throw new Error('o navegador do container nao respondeu')
  }
  const perfil = mkdtempSync(join(chrome.perfis, 'erp-verificacao-'))
  const proc = spawn(chrome.cmd, [...chrome.args, '--headless=new', '--remote-debugging-port=0',
    `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
  { stdio: 'ignore', detached: process.platform !== 'win32' })
  // binário inexistente ou sem permissão: sem este ouvinte o erro derrubaria o processo inteiro
  let falhou = null
  proc.on('error', (e) => { falhou = e })
  // Processos que usam este perfil. No Flatpak o Chrome roda dentro do sandbox, fora do grupo
  // de processos do `spawn`; matar o grupo não basta, então a limpeza procura pelo perfil.
  const vivosDoPerfil = () => {
    if (process.platform === 'win32') return []
    try { return execFileSync('pgrep', ['-f', perfil], { encoding: 'utf8' }).split('\n').filter(Boolean).map(Number) } catch { return [] }
  }
  const encerrar = async () => {
    try { process.platform === 'win32' ? proc.kill() : process.kill(-proc.pid, 'SIGTERM') } catch { /* ja saiu */ }
    for (let i = 0; i < 40 && vivosDoPerfil().length; i++) await esperar(250)
    for (const pid of vivosDoPerfil()) { try { process.kill(pid, 'SIGKILL') } catch { /* ja saiu */ } }
    for (let i = 0; i < 20 && vivosDoPerfil().length; i++) await esperar(250)
    rmSync(perfil, { recursive: true, force: true })
  }
  // com a porta 0 o Chrome escolhe uma livre e a escreve neste arquivo
  const arquivoPorta = join(perfil, 'DevToolsActivePort')
  for (let i = 0; i < 60 && !existsSync(arquivoPorta) && !falhou; i++) await esperar(250)
  if (!existsSync(arquivoPorta)) {
    await encerrar()
    throw new Error(`o navegador nao abriu (${chrome.cmd}): ${falhou?.message ?? 'sem resposta em 15 s'}. ${COMO_CONSEGUIR_UM_NAVEGADOR}`)
  }
  return { porta: readFileSync(arquivoPorta, 'utf8').split('\n')[0], perfil, encerrar }
}

export async function abrirNavegador() {
  const chrome = acharChrome()
  if (!chrome) throw new Error(COMO_CONSEGUIR_UM_NAVEGADOR)
  const { porta, perfil, encerrar } = await lancar(chrome)
  let fecharPeloCdp = async () => {}
  const fechar = async () => { await fecharPeloCdp(); await encerrar() }

  try {
    let alvo
    for (let i = 0; i < 20 && !alvo; i++) {
      alvo = (await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()).find((t) => t.type === 'page')
      if (!alvo) await esperar(250)
    }
    const ws = new WebSocket(alvo.webSocketDebuggerUrl)
    await new Promise((ok, erro) => { ws.onopen = ok; ws.onerror = erro })

    let proximo = 0
    const pendentes = new Map()
    const ouvintes = new Set()
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data)
      if (msg.id && pendentes.has(msg.id)) {
        const { ok, erro } = pendentes.get(msg.id); pendentes.delete(msg.id)
        msg.error ? erro(new Error(msg.error.message)) : ok(msg.result)
      } else if (msg.method) for (const f of ouvintes) f(msg)
    }
    const cdp = (method, params = {}) => new Promise((ok, erro) => {
      const id = ++proximo; pendentes.set(id, { ok, erro }); ws.send(JSON.stringify({ id, method, params }))
    })
    await cdp('Network.enable'); await cdp('Page.enable'); await cdp('Runtime.enable')
    // fechar pelo próprio protocolo atravessa o sandbox do Flatpak
    fecharPeloCdp = async () => { try { await Promise.race([cdp('Browser.close'), esperar(2000)]) } catch { /* ja fechou */ } }

    // toda resposta vista pela página, com corpo, para procurar vazamento em qualquer uma delas
    const respostas = []
    const vivas = new Map()
    // em voo desde a SAÍDA da requisição: contar só a partir da resposta dava a rede como parada
    // enquanto uma requisição lenta ainda nem tinha respondido
    const emVoo = new Set()
    const pedidos = []   // o que a página PEDIU, com cabeçalhos, mesmo que a resposta falhe
    ouvintes.add(async (msg) => {
      if (msg.method === 'Network.requestWillBeSent') {
        emVoo.add(msg.params.requestId)
        pedidos.push({ url: msg.params.request.url, headers: msg.params.request.headers })
      }
      if (msg.method === 'Network.loadingFailed') {
        emVoo.delete(msg.params.requestId)
        respostas.push({ url: vivas.get(msg.params.requestId)?.url ?? '?', status: 0, headers: {}, corpo: '', falhou: msg.params.errorText })
        vivas.delete(msg.params.requestId)
      }
      if (msg.method === 'Network.responseReceived') {
        vivas.set(msg.params.requestId, { url: msg.params.response.url, status: msg.params.response.status, headers: msg.params.response.headers })
      } else if (msg.method === 'Network.loadingFinished' && vivas.has(msg.params.requestId)) {
        const r = vivas.get(msg.params.requestId); vivas.delete(msg.params.requestId); emVoo.delete(msg.params.requestId)
        try { const b = await cdp('Network.getResponseBody', { requestId: msg.params.requestId }); r.corpo = b.base64Encoded ? Buffer.from(b.body, 'base64').toString('utf8') : b.body } catch { r.corpo = '' }
        respostas.push(r)
      }
    })

    const pagina = {
      respostas,
      pedidos,
      cdp,
      async cookie(nome, valor, url) {
        await cdp('Network.setCookie', { name: nome, value: valor, url, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' })
      },
      async ir(url) {
        const carregou = new Promise((ok) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { ouvintes.delete(f); ok() } }; ouvintes.add(f) })
        await cdp('Page.navigate', { url })
        await Promise.race([carregou, esperar(15_000)])
        await esperar(300)
      },
      async avaliar(expr) {
        const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
        return r.result.value
      },
      /** Espera a rede ficar parada por `quietoMs` (a navegação do cliente é assíncrona). */
      async esperarRede(quietoMs = 500, maxMs = 10_000) {
        const fim = Date.now() + maxMs
        let n = -1
        while (Date.now() < fim) {
          if (emVoo.size === 0 && vivas.size === 0 && respostas.length === n) return
          n = respostas.length; await esperar(quietoMs)
        }
      },
    }
    return { pagina, perfil, fechar: async () => { await fechar(); try { ws.close() } catch { /* ja fechou */ } } }
  } catch (e) {
    await fechar()
    throw e
  }
}
