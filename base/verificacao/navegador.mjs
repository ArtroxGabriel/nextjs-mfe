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

/** Como abrir o Chrome nesta máquina, ou `null` se não houver. `ERP_CHROME` força um binário. */
export function acharChrome() {
  if (process.env.ERP_CHROME) return { cmd: process.env.ERP_CHROME, args: [], perfis: tmpdir() }
  for (const b of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { const cmd = execFileSync('which', [b], { encoding: 'utf8' }).trim(); if (cmd) return { cmd, args: [], perfis: tmpdir() } } catch { /* segue */ }
  }
  try {
    execFileSync('flatpak', ['info', 'com.google.Chrome'], { stdio: 'ignore' })
    // o sandbox do Flatpak só escreve na pasta do próprio app; o perfil temporário fica lá
    const perfis = join(homedir(), '.var/app/com.google.Chrome/cache')
    mkdirSync(perfis, { recursive: true })
    return { cmd: 'flatpak', args: ['run', 'com.google.Chrome'], perfis }
  } catch { return null }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

export async function abrirNavegador() {
  const chrome = acharChrome()
  if (!chrome) throw new Error('nenhum Chrome encontrado (instale ou defina ERP_CHROME)')
  const perfil = mkdtempSync(join(chrome.perfis, 'erp-verificacao-'))
  const proc = spawn(chrome.cmd, [...chrome.args, '--headless=new', '--remote-debugging-port=0',
    `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
  { stdio: 'ignore', detached: true })

  // Processos que usam este perfil. No Flatpak o Chrome roda dentro do sandbox, fora do grupo
  // de processos do `spawn`; matar o grupo não basta, então a limpeza procura pelo perfil.
  const vivosDoPerfil = () => {
    try { return execFileSync('pgrep', ['-f', perfil], { encoding: 'utf8' }).split('\n').filter(Boolean).map(Number) } catch { return [] }
  }
  let fecharPeloCdp = async () => {}
  const fechar = async () => {
    await fecharPeloCdp()
    try { process.kill(-proc.pid, 'SIGTERM') } catch { /* ja saiu */ }
    for (let i = 0; i < 40 && vivosDoPerfil().length; i++) await esperar(250)
    for (const pid of vivosDoPerfil()) { try { process.kill(pid, 'SIGKILL') } catch { /* ja saiu */ } }
    for (let i = 0; i < 20 && vivosDoPerfil().length; i++) await esperar(250)
    rmSync(perfil, { recursive: true, force: true })
  }

  try {
    // com a porta 0 o Chrome escolhe uma livre e a escreve neste arquivo
    const arquivoPorta = join(perfil, 'DevToolsActivePort')
    for (let i = 0; i < 60 && !existsSync(arquivoPorta); i++) await esperar(250)
    const porta = readFileSync(arquivoPorta, 'utf8').split('\n')[0]
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
    ouvintes.add(async (msg) => {
      if (msg.method === 'Network.responseReceived') {
        vivas.set(msg.params.requestId, { url: msg.params.response.url, status: msg.params.response.status, headers: msg.params.response.headers })
      } else if (msg.method === 'Network.loadingFinished' && vivas.has(msg.params.requestId)) {
        const r = vivas.get(msg.params.requestId); vivas.delete(msg.params.requestId)
        try { const b = await cdp('Network.getResponseBody', { requestId: msg.params.requestId }); r.corpo = b.base64Encoded ? Buffer.from(b.body, 'base64').toString('utf8') : b.body } catch { r.corpo = '' }
        respostas.push(r)
      }
    })

    const pagina = {
      respostas,
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
        while (Date.now() < fim) { if (vivas.size === 0 && respostas.length === n) return; n = respostas.length; await esperar(quietoMs) }
      },
    }
    return { pagina, perfil, fechar: async () => { await fechar(); try { ws.close() } catch { /* ja fechou */ } } }
  } catch (e) {
    await fechar()
    throw e
  }
}
