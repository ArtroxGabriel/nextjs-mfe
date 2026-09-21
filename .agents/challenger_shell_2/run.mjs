// challenger_shell_2 — execução ao vivo, iteração 2 do gate "Shell novo".
// Não edita repos/ nem base/: só lê e importa. Evidência bruta escrita em .agents/challenger_shell_2/.
import { createServer } from 'node:http'
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { subir, SHELL as SHELL_URL } from '../../base/scripts/ambiente.mjs'
import { pedir, entrar } from '../../base/verificacao/apoio.mjs'

const DIR = new URL('.', import.meta.url).pathname
mkdirSync(DIR, { recursive: true })
const out = (nome, conteudo) => writeFileSync(DIR + nome, conteudo)
const log = (nome, linha) => appendFileSync(DIR + nome, linha + '\n')

const lotesNoColetor = []
let coletor
let ambiente

async function main() {
  coletor = createServer((req, res) => {
    let tam = 0
    req.on('data', (c) => (tam += c.length))
    req.on('end', () => {
      lotesNoColetor.push({ ts: Date.now(), url: req.url, tamanho: tam })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
  })
  await new Promise((ok) => coletor.listen(0, '127.0.0.1', ok))
  const portaColetor = coletor.address().port
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `http://127.0.0.1:${portaColetor}`
  console.log('coletor falso proprio em', portaColetor)

  console.log('subindo ambiente (builds existentes)...')
  ambiente = await subir({ construir: false })
  console.log('ambiente no ar. SESSAO_DIR =', ambiente.sessaoDir)

  await item2GestaoAcessoFora()
  await item3Telemetria(portaColetor)
  await item1CasosDeCaixaZonaFora()
  await item4JanelaERecuperacao()

  console.log('TUDO CONCLUIDO')
}

// ------------------------------------------------------------------------------------------
// ITEM 2 — gestão de acesso fora: HTML inteiro + payload RSC (self.__next_f), e requisição
// de navegação RSC de verdade (cabeçalho RSC:1 + Next-Router-State-Tree de /zona1 -> /zona1/relatorios)
// ------------------------------------------------------------------------------------------
async function item2GestaoAcessoFora() {
  const evid = 'item2-gestao-acesso-fora.txt'
  out(evid, '')
  log(evid, '=== ITEM 2: gestao de acesso (:4010) fora do ar ===')

  const usuarios = {}
  for (const u of ['davi', 'bruno', 'ana']) usuarios[u] = (await entrar(u)).cookie
  log(evid, 'logins ok: ' + Object.keys(usuarios).join(', '))

  await ambiente.derrubarDominio('gestao-acesso')
  log(evid, 'gestao-acesso derrubada em ' + Date.now())

  const PADROES_SENSIVEIS = [
    /Painel da zona 1/, /Relatórios/i, /recursos no seu escopo/, /com custo/i,
    /CC-10/, /Custo/, /aria-label="Módulos"/, /Conferir invent/, /Revisar cadastro/,
    /Gestão de acesso/i, /svc\./, /Bearer /,
  ]

  try {
    for (const [quem, cookie] of Object.entries(usuarios)) {
      for (const caminho of ['/zona1', '/zona1/relatorios', '/zona2', '/acesso', '/']) {
        const r = await pedir(caminho, { cookie })
        const achados = PADROES_SENSIVEIS.filter((re) => re.test(r.html)).map((re) => re.source)
        const temFlight = r.html.includes('self.__next_f')
        // procura no flight payload especificamente por qualquer trecho reconhecivel de menu/modulo
        const flightMatches = [...r.html.matchAll(/self\.__next_f\.push\(\[[^\]]*\]\)/g)]
          .map((m) => m[0])
          .filter((s) => PADROES_SENSIVEIS.some((re) => re.test(s)))
        log(evid,
          `${quem} ${caminho}: status=${r.status} achados_html=[${achados.join('|')}] ` +
          `tem_next_f=${temFlight} achados_no_flight=${flightMatches.length}`)
        if (achados.length || flightMatches.length) {
          log(evid, `  !!! VAZAMENTO SUSPEITO ${quem} ${caminho}: ${JSON.stringify({ achados, flightMatches })}`)
          out(`item2-VAZAMENTO-${quem}-${caminho.replaceAll('/', '_')}.html`, r.html)
        }
      }
    }

    // Requisição RSC "de navegação de cliente" de verdade: cabeçalho RSC:1 e
    // Next-Router-State-Tree simulando estar em /zona1 navegando para /zona1/relatorios.
    log(evid, '')
    log(evid, '--- requisicao RSC de navegacao (RSC:1 + Next-Router-State-Tree) ---')
    const arvoreEmZona1 = encodeURIComponent(JSON.stringify(['', { children: ['zona1', { children: ['__PAGE__', {}] }] }, null, null, true]))
    for (const [quem, cookie] of Object.entries(usuarios)) {
      const resp = await fetch(`${SHELL_URL}/zona1/relatorios`, {
        headers: {
          cookie,
          RSC: '1',
          'Next-Router-State-Tree': arvoreEmZona1,
          'Next-Url': '/zona1',
        },
        redirect: 'manual',
      })
      const corpo = await resp.text()
      const achados = PADROES_SENSIVEIS.filter((re) => re.test(corpo)).map((re) => re.source)
      log(evid,
        `RSC-nav ${quem} /zona1 -> /zona1/relatorios: status=${resp.status} content-type=${resp.headers.get('content-type')} ` +
        `bytes=${corpo.length} achados=[${achados.join('|')}]`)
      if (achados.length) {
        out(`item2-RSC-VAZAMENTO-${quem}.txt`, corpo)
        log(evid, `  !!! VAZAMENTO no payload RSC de navegacao para ${quem}`)
      }
    }
  } finally {
    await ambiente.subirDominio('gestao-acesso')
    log(evid, 'gestao-acesso reerguida em ' + Date.now())
    const r = await pedir('/zona1', { cookie: usuarios.bruno })
    log(evid, `pos-recuperacao bruno /zona1 status=${r.status} (esperado 200 apos reenvio de manifestos)`)
  }
}

// ------------------------------------------------------------------------------------------
// ITEM 3 — gateway de telemetria
// ------------------------------------------------------------------------------------------
async function item3Telemetria(portaColetor) {
  const evid = 'item3-telemetria.txt'
  out(evid, '')
  log(evid, '=== ITEM 3: gateway /api/otel/v1/traces ===')

  const bruno = (await entrar('bruno')).cookie
  const carla = (await entrar('carla')).cookie

  const post = (headers, body) =>
    fetch(`${SHELL_URL}/api/otel/v1/traces`, { method: 'POST', body, duplex: body ? 'half' : undefined, headers })

  // 3.1 anonimo: nao deve chegar ao coletor
  lotesNoColetor.length = 0
  const r1 = await post({ 'content-type': 'application/json' }, '{}')
  await new Promise((r) => setTimeout(r, 250))
  log(evid, `3.1 anonimo: status=${r1.status} coletor_recebeu=${lotesNoColetor.length} (esperado 204, 0)`)

  // 3.2 300 KB chunked sem Content-Length, com sessao — deve dar 413 sem ler tudo (medir memoria/tempo)
  const memAntes = process.memoryUsage().rss
  const t0 = Date.now()
  const fluxo300k = new ReadableStream({
    start(c) {
      const pedaco = new Uint8Array(4096)
      let enviado = 0
      const alvo = 300 * 1024
      const push = () => {
        if (enviado >= alvo) return c.close()
        c.enqueue(pedaco)
        enviado += pedaco.length
        push()
      }
      push()
    },
  })
  const r2 = await post({ 'content-type': 'application/json', cookie: bruno }, fluxo300k)
  const t1 = Date.now()
  const memDepois = process.memoryUsage().rss
  log(evid, `3.2 300KB chunked sem Content-Length: status=${r2.status} tempo_ms=${t1 - t0} ` +
    `rss_antes=${memAntes} rss_depois=${memDepois} delta_kb=${((memDepois - memAntes) / 1024).toFixed(0)}`)

  // 3.3 20 MB chunked sem Content-Length — deve cortar em streaming (413), sem bufferizar tudo
  const memAntes20 = process.memoryUsage().rss
  const t2 = Date.now()
  const fluxo20m = new ReadableStream({
    start(c) {
      const pedaco = new Uint8Array(64 * 1024)
      let enviado = 0
      const alvo = 20 * 1024 * 1024
      const push = () => {
        if (enviado >= alvo) return c.close()
        c.enqueue(pedaco)
        enviado += pedaco.length
        push()
      }
      push()
    },
  })
  const r3 = await post({ 'content-type': 'application/json', cookie: bruno }, fluxo20m)
  const t3 = Date.now()
  const memDepois20 = process.memoryUsage().rss
  log(evid, `3.3 20MB chunked sem Content-Length: status=${r3.status} tempo_ms=${t3 - t2} ` +
    `rss_antes=${memAntes20} rss_depois=${memDepois20} delta_kb=${((memDepois20 - memAntes20) / 1024).toFixed(0)}`)

  // 3.4 Content-Length mentiroso, MENOR que o corpo real
  try {
    const r4 = await fetch(`${SHELL_URL}/api/otel/v1/traces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: bruno, 'content-length': '10' },
      body: 'x'.repeat(300 * 1024),
    })
    log(evid, `3.4 Content-Length menor que o corpo: status=${r4.status}`)
  } catch (e) {
    log(evid, `3.4 Content-Length menor que o corpo: excecao no cliente = ${e.message} (Node pode corrigir o header sozinho; ver nota)`)
  }

  // 3.5 corpo nao-JSON -> 400
  const r5 = await post({ 'content-type': 'application/json', cookie: bruno }, 'isto nao e json {{{')
  log(evid, `3.5 corpo nao-JSON: status=${r5.status} (esperado 400)`)

  // 3.6 61 lotes em sequencia -> 429 no 61
  let ultimo
  const resultados61 = []
  for (let i = 0; i < 61; i++) {
    ultimo = await post({ 'content-type': 'application/json', cookie: carla }, '{}')
    resultados61.push(ultimo.status)
  }
  log(evid, `3.6 61 lotes sequenciais: status_final=${ultimo.status} retry-after=${ultimo.headers.get('retry-after')} ` +
    `contagem=${JSON.stringify(resultados61.reduce((a, s) => ((a[s] = (a[s] || 0) + 1), a), {}))}`)

  // 3.7 coletor fora do ar: resposta ao chamador deve seguir 204 e rapida.
  // nucleo.destino('coletor-otel') aponta para o OTEL_EXPORTER_OTLP_ENDPOINT fixado no boot
  // do shell, que é o coletor falso deste script (portaColetor). Para simular "coletor fora",
  // derrubamos esse coletor temporariamente e reerguemos na mesma porta depois.
  // Usa 'davi' (nao usado em 3.6) para nao herdar o 429 do limitador de taxa por 'sub' de carla.
  await new Promise((ok) => coletor.close(ok))
  const davi = (await entrar('davi')).cookie
  const t4 = Date.now()
  const r7 = await post({ 'content-type': 'application/json', cookie: davi }, '{}')
  const t5 = Date.now()
  log(evid, `3.7 coletor fora do ar: status=${r7.status} tempo_ms=${t5 - t4} (esperado 204 rapido, catch silencioso em lib/nucleo)`)
  // religa o coletor para nao quebrar o resto do teste (mesma porta)
  coletor.listen(portaColetor, '127.0.0.1')
  await new Promise((ok) => setTimeout(ok, 100))

  log(evid, '')
  log(evid, 'lotes efetivamente recebidos pelo coletor falso ao longo do item 3:')
  log(evid, JSON.stringify(lotesNoColetor, null, 2))
}

// ------------------------------------------------------------------------------------------
// ITEM 1 — variantes de caixa e caminho adversario com zona fora, para zona1, zona2 e acesso
// ------------------------------------------------------------------------------------------
async function item1CasosDeCaixaZonaFora() {
  const evid = 'item1-caminhos-adversarios-zona-fora.txt'
  out(evid, '')
  log(evid, '=== ITEM 1: zona morta + variantes de caixa/caminho, para zona1, zona2 e acesso ===')

  const ana = (await entrar('ana')).cookie

  const casos = [
    { app: 'erp-zona-2', id: 'zona2', porta: 3002 },
    { app: 'erp-zona-1', id: 'zona1' },
    { app: 'erp-zona-acesso', id: 'acesso', porta: 3003 },
  ]

  for (const { app, id } of casos) {
    log(evid, `\n--- derrubando ${app} (${id}) ---`)
    await ambiente.derrubarApp(app)
    await new Promise((r) => setTimeout(r, 1200)) // passa do TTL de 1s da sonda de saude
    log(evid, `${app} derrubada, TTL vencido`)

    const variantesManuais = [
      `/${id.toUpperCase()}`,
      `/${id[0].toUpperCase()}${id.slice(1)}/x`,
      `/${id[0]}${id.slice(1).toUpperCase()}-static/a.js`, // ex: zONA2-static
      `/${id}/..`,
      `/${id}/../${id}`,
      `/${id}%2F..`,
      `/%7A${id.slice(1)}`,
      `/${id}-static/../${id}`,
      `//${id}`,
    ]
    for (const caminho of variantesManuais) {
      const r = await fetch(`${SHELL_URL}${caminho}`, { headers: { cookie: ana }, redirect: 'manual' })
      const corpo = await r.text()
      const ct = r.headers.get('content-type')
      const retryAfter = r.headers.get('retry-after')
      const ehErroProprio = corpo.includes('temporariamente indisponível') || corpo.includes(TITULO_MARCADOR)
      log(evid,
        `${app} morta, caminho=${JSON.stringify(caminho)}: status=${r.status} content-type=${ct} ` +
        `retry-after=${retryAfter} tamanho_corpo=${corpo.length} pagina_propria=${corpo.includes('temporariamente indisponível')} ` +
        `raw_500=${corpo.trim() === 'Internal Server Error'}`)
    }

    // controle: caminho minusculo exato deve dar 503 correto
    const controle = await fetch(`${SHELL_URL}/${id}`, { headers: { cookie: ana }, redirect: 'manual' })
    const corpoControle = await controle.text()
    log(evid, `${app} morta, controle /${id}: status=${controle.status} pagina_propria=${corpoControle.includes('temporariamente indisponível')}`)

    await ambiente.subirApp(app)
    log(evid, `${app} reerguida`)
    // espera voltar de verdade antes de seguir para a proxima zona
    let ok = false
    for (let i = 0; i < 50 && !ok; i++) {
      const r = await fetch(`${SHELL_URL}/${id}`, { headers: { cookie: ana }, redirect: 'manual' })
      ok = r.status === 200
      if (!ok) await new Promise((r2) => setTimeout(r2, 100))
    }
    log(evid, `${app} confirmada de volta: ${ok}`)
  }
}
const TITULO_MARCADOR = 'Zona temporariamente indisponível'

// ------------------------------------------------------------------------------------------
// ITEM 4 — janela apos a queda, zona travada e tempo de recuperacao (n>=3), com contexto de carga
// ------------------------------------------------------------------------------------------
async function item4JanelaERecuperacao() {
  const evid = 'item4-janela-e-recuperacao.txt'
  out(evid, '')
  log(evid, '=== ITEM 4: janela pos-queda e tempo de recuperacao (zona 2) ===')
  const ana = (await entrar('ana')).cookie

  const loadAvg = (await import('node:os')).loadavg()
  log(evid, `load average no inicio do item 4: ${loadAvg.join(', ')}`)

  // aquece o cache de saude como "ok" antes de matar
  await fetch(`${SHELL_URL}/zona2`, { headers: { cookie: ana }, redirect: 'manual' })

  // 4.1 janela pos-queda: 40 requisicoes concorrentes logo apos SIGKILL
  const tMorte = Date.now()
  await ambiente.derrubarApp('erp-zona-2')
  const promessas = []
  for (let i = 0; i < 40; i++) {
    promessas.push(
      fetch(`${SHELL_URL}/zona2`, { headers: { cookie: ana }, redirect: 'manual' }).then(async (r) => ({
        dt: Date.now() - tMorte,
        status: r.status,
        corpo: (await r.text()).slice(0, 60),
      }))
    )
  }
  const resultados = await Promise.all(promessas)
  log(evid, '4.1 janela pos-queda (40 requisicoes concorrentes):')
  for (const r of resultados) log(evid, `  dt=${r.dt}ms status=${r.status} corpo=${JSON.stringify(r.corpo)}`)
  const contagem41 = resultados.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {})
  log(evid, `4.1 resumo: ${JSON.stringify(contagem41)}, n=${resultados.length}`)

  // 4.2 recuperacao: reergue e mede o primeiro 200, 3 vezes
  const temposRecuperacao = []
  for (let rodada = 1; rodada <= 3; rodada++) {
    const t0 = Date.now()
    await ambiente.subirApp('erp-zona-2')
    let primeiro200 = null
    for (let i = 0; i < 300 && primeiro200 === null; i++) {
      const r = await fetch(`${SHELL_URL}/zona2`, { headers: { cookie: ana }, redirect: 'manual' })
      if (r.status === 200) primeiro200 = Date.now() - t0
      else await new Promise((res) => setTimeout(res, 20))
    }
    temposRecuperacao.push(primeiro200)
    log(evid, `4.2 rodada ${rodada}: primeiro 200 em ${primeiro200}ms (load avg ${(await import('node:os')).loadavg().join(',')})`)
    if (rodada < 3) {
      await ambiente.derrubarApp('erp-zona-2')
      await new Promise((r) => setTimeout(r, 1200))
    }
  }
  log(evid, `4.2 resumo n=3: ${JSON.stringify(temposRecuperacao)}`)

  log(evid, 'zona 2 permanece no ar ao final deste item para os proximos passos do script')
}

main()
  .catch((e) => {
    console.error('ERRO FATAL', e)
    process.exitCode = 1
  })
  .finally(async () => {
    console.log('derrubando ambiente...')
    try { coletor?.close() } catch {}
    try { await ambiente?.derrubar() } catch (e) { console.error('erro ao derrubar', e) }
    console.log('ambiente derrubado')
  })
