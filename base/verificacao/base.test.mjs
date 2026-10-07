// Verificação ponta a ponta da base genérica (ADR-0009). Tudo pelo shell, como no navegador.
//   node --test base/verificacao/*.test.mjs
// Sobe domínios, registra manifestos, sobe shell e zonas; derruba no fim.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { generateKeyPairSync, sign, createHmac } from 'node:crypto'
import { subir, RAIZ, SHELL as SHELL_URL, APPS, ambienteDoPapel } from '../scripts/ambiente.mjs'
import { pedir, entrar, iniciarLogin, menu, formularios, valorDoCookie, acaoPeloCliente, keycloakNoAr, tokenDoKeycloak, KEYCLOAK_EMISSOR, redisCru } from './apoio.mjs'
import { abrirNavegador, acharChrome, COMO_CONSEGUIR_UM_NAVEGADOR } from './navegador.mjs'
import { varrerAplicacoes } from './saida-de-rede.mjs'
import { subirZonaDeTeste } from './zona-de-teste.mjs'

let ambiente
// zona de teste do C3 (L9b, L9c, L10, L11), subida sob demanda por `zona9DeTeste()`
let zona9
// Coletor OTLP falso: prova que o gateway de telemetria do shell só repassa lote de quem tem sessão.
let coletor
const lotesNoColetor = []
before(async () => {
  coletor = createServer((req, res) => { lotesNoColetor.push(req.url); req.resume(); req.on('end', () => res.end()) })
  await new Promise((ok) => coletor.listen(0, '127.0.0.1', ok))
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `http://127.0.0.1:${coletor.address().port}`
  // senha de escrita do shell sempre definida, como fora da máquina local (auditor_b1_d1_8, V1): o teste
  // de ambiente abaixo procura o valor dela em tudo o que zona e domínio recebem
  process.env.ERP_REDIS_SENHA_SHELL ??= 'sentinela-k5-senha-de-escrita'
  // teto da zona (D7) diferente do padrão de 10 s: o L9 prova que o shell lê a variável. Maior que ERP_DESTINO_TIMEOUT_MS
  // (5 s), senão o shell recusa subir
  process.env.ERP_ZONA_TETO_MS ??= '6000'
  // C3: ociosidade do gateway (L9c) e TTL do mapa vivo (L10, L11) curtos, para a verificação não esperar os padrões
  // maior que ERP_DESTINO_TIMEOUT_MS (5 s), senão o shell recusa subir; ainda curta o bastante para o L9c não esperar 10 s
  process.env.ERP_ZONA_OCIOSIDADE_MS ??= '7000'
  process.env.ERP_MAPA_ZONAS_TTL_MS ??= '2000'
  // CONSTRUIR=1 reconstrói só as apps com fonte mais novo que o build; CONSTRUIR=tudo, todas
  ambiente = await subir({ construir: process.env.CONSTRUIR === 'tudo' ? 'tudo' : process.env.CONSTRUIR === '1' })
}, { timeout: 600_000 })
after(async () => { ambiente?.derrubar(); coletor?.close(); await zona9?.fechar() })

const TOKEN = /dev\.(ana|bruno|carla|davi|eva)\.[0-9a-f-]{36}/

// Páginas de uma app, com a rota que o Next serve para cada uma. `page.(tsx|ts|jsx|js)`: o auditor_shell_4
// mostrou que só `page.tsx` deixava passar uma página em `.ts` sem exigirModulo.
const PAGINA = /^page\.(tsx|ts|jsx|js)$/
function paginasDaApp(app, { pularPublico }) {
  const raiz = join(RAIZ, app, 'app')
  const andar = (d) => readdirSync(d).flatMap((n) => {
    const p = join(d, n)
    if (pularPublico && n === '(publico)') return []
    return statSync(p).isDirectory() ? andar(p) : PAGINA.test(n) ? [p] : []
  })
  return andar(raiz).map((arquivo) => {
    // grupos `(x)` e rotas paralelas `@x` não aparecem na URL
    const segs = arquivo.slice(raiz.length + 1).split('/').slice(0, -1).filter((g) => !/^\(.*\)$/.test(g) && !g.startsWith('@'))
    return { arquivo, rota: '/' + segs.join('/'), dinamicos: segs.filter((g) => g.startsWith('[')).length }
  })
}
// URL → regex da rota: [x] um segmento, [...x] um ou mais, [[...x]] zero ou mais
const padraoDaRota = (rota) => new RegExp('^' + rota
  .replace(/\/\[\[\.\.\.[^\]]+\]\]/g, '(?:/.*)?')
  .replace(/\[\.\.\.[^\]]+\]/g, '.+')
  .replace(/\[[^\]]+\]/g, '[^/]+') + '$')

test('C3: depois da subida, cada zona registrou a propria rota na gestao de acesso (GET /v2/zonas com svc.shell)', async () => {
  const r = await fetch('http://127.0.0.1:4020/v2/zonas', { headers: { authorization: 'Bearer svc.shell' }, redirect: 'manual' })
  assert.equal(r.status, 200)
  const zonas = await r.json()
  assert.deepEqual(
    zonas.map(({ id, origem }) => ({ id, origem })).sort((a, b) => a.id.localeCompare(b.id)),
    [{ id: 'acesso', origem: 'http://127.0.0.1:3003' }, { id: 'zona1', origem: 'http://127.0.0.1:3001' }, { id: 'zona2', origem: 'http://127.0.0.1:3002' }],
  )
})

test('C3: o mapa so se le com svc.shell; token de zona ou nenhum token nao leem', async () => {
  for (const [quem, auth] of [['svc.zona1', 'Bearer svc.zona1'], ['svc.acesso', 'Bearer svc.acesso'], ['sem token', null], ['usuario', 'Bearer dev.ana.00000000-0000-0000-0000-000000000000']]) {
    const r = await fetch('http://127.0.0.1:4020/v2/zonas', { headers: auth ? { authorization: auth } : {}, redirect: 'manual' })
    assert.ok([401, 404].includes(r.status), `${quem}: HTTP ${r.status}`)
    assert.doesNotMatch(await r.text(), /127\.0\.0\.1:300/, `${quem}: o corpo trouxe origem de zona`)
  }
})

test('C3: guarda do mapa no Redis: o shell grava erp:mapa-zonas com validade, e um shell novo com a fonte fora roteia por ela', {
  skip: !process.env.REDIS_URL && 'so no modo Redis (task verificar:redis)', timeout: 120_000,
}, async () => {
  const ana = (await entrar('ana')).cookie
  // sem a chave de rodadas anteriores (validade de um dia): so conta o que este shell gravar agora
  await redisCru(process.env.REDIS_URL, [['DEL', 'erp:mapa-zonas']])
  const ttl = Number(process.env.ERP_MAPA_ZONAS_TTL_MS)
  const t0 = Date.now()
  let resp = ''
  let json
  while (!json && Date.now() - t0 < 3 * ttl + 2_000) {
    assert.equal((await pedir('/zona1', { cookie: ana })).status, 200)   // cada releitura boa do mapa grava a guarda
    resp = await redisCru(process.env.REDIS_URL, [['GET', 'erp:mapa-zonas'], ['PTTL', 'erp:mapa-zonas']])
    json = resp.match(/^\$\d+\r\n(\[.*\])\r\n/m)?.[1]
    if (!json) await new Promise((ok) => setTimeout(ok, 250))
  }
  assert.ok(json, `o shell nao gravou a guarda em ${3 * ttl + 2_000} ms: ${resp.slice(0, 200)}`)
  assert.deepEqual(JSON.parse(json).map((z) => z.id).filter((id) => ['acesso', 'zona1', 'zona2'].includes(id)).sort(), ['acesso', 'zona1', 'zona2'])
  const pttl = Number(resp.match(/^:(-?\d+)\r$/m)?.[1])
  const validade = Number(process.env.ERP_MAPA_ZONAS_GUARDA_S ?? 86_400) * 1000
  assert.ok(pttl > validade - 120_000 && pttl <= validade, `PTTL ${pttl}; validade ${validade}`)

  // ida e volta: outro shell, com a gestão de acesso inalcançável, sobe frio e roteia pelo mapa da guarda
  const derrubar = await ambiente.subirAppAvulsa('erp-shell', { porta: 3010, envExtra: { ACESSO_URL: 'http://127.0.0.1:4119' }, caminho: '/login' })
  try {
    const r = await fetch('http://localhost:3010/zona1', { headers: { cookie: ana }, redirect: 'manual' })
    assert.equal(r.status, 200, 'o shell frio sem a fonte nao roteou pela guarda')
    assert.match(await r.text(), /<nav[^>]*aria-label="Módulos"/)
  } finally { await derrubar() }
})

test('camada 1: sem cookie, shell e zonas mandam para o login do shell, com Location relativo', async () => {
  for (const caminho of ['/', '/zona1', '/zona1/relatorios', '/zona2', '/acesso']) {
    const r = await pedir(caminho)
    assert.equal(r.status, 307, caminho)
    assert.equal(r.local, `/login?de=${encodeURIComponent(caminho)}`, caminho)
  }
  assert.equal((await pedir('/login')).status, 200)
})

test('N3: o shell grava a sessao e o navegador recebe so um id opaco, HttpOnly e __Host-', async () => {
  const { resposta, id } = await entrar('ana')
  assert.equal(resposta.status, 303)
  assert.equal(resposta.local, '/')
  const c = resposta.cookies.find((x) => x.startsWith('__Host-session='))
  assert.match(c, /HttpOnly/i); assert.match(c, /Secure/i); assert.match(c, /Path=\//); assert.match(c, /SameSite=lax/i)
  assert.match(id, /^[0-9a-f-]{36}$/)
  assert.ok(!TOKEN.test(id))
})

test('login nao vira redirecionamento aberto', async () => {
  for (const de of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
    assert.equal((await entrar('ana', de)).resposta.local, '/', de)
  }
  assert.equal((await entrar('ana', '/zona2')).resposta.local, '/zona2')
  const r = await iniciarLogin('intruso')
  assert.equal(r.local, '/login')
  assert.equal(valorDoCookie(r.cookies, '__Host-session'), undefined)
})

// Uma entrada por módulo (v2); "Gestão de acesso" só para quem tem papel (ADR-0014, adendo 1)
const MENUS = {
  ana: ['/', '/zona1', '/zona2'],
  bruno: ['/', '/zona1'],
  carla: ['/', '/zona1', '/acesso'],
  davi: ['/', '/zona1'],
}

test('N5: o menu mostra so os modulos permitidos, igual no shell e nas zonas (moldura comum)', async () => {
  for (const [u, esperado] of Object.entries(MENUS)) {
    const { cookie } = await entrar(u)
    const noShell = menu((await pedir('/', { cookie })).html)
    assert.deepEqual(noShell.hrefs, esperado, `menu de ${u} no shell`)
    assert.deepEqual(noShell.atual, ['/'])
    const naZona = menu((await pedir('/zona1', { cookie })).html)
    assert.deepEqual(naZona.hrefs, esperado, `menu de ${u} na zona 1`)
    assert.deepEqual(naZona.atual, ['/zona1'])
  }
})

test('L3 (auditor_b1_d1_3, P10): o link de Relatorios so aparece para quem tem a funcionalidade (invariante 8)', async () => {
  const link = /href="\/zona1\/relatorios"/
  assert.doesNotMatch((await pedir('/zona1', { cookie: (await entrar('davi')).cookie })).html, link, 'davi (so painel.ver) ve o link')
  assert.match((await pedir('/zona1', { cookie: (await entrar('bruno')).cookie })).html, link, 'bruno (relatorios.ver) nao ve o link')
})

test('N5/D6: modulo nao permitido responde 404 pela URL direta; permitido responde 200', async () => {
  const casos = [
    ['ana', '/zona1/relatorios', 404], ['ana', '/acesso', 404], ['ana', '/zona2', 200],
    ['bruno', '/zona1/relatorios', 200], ['bruno', '/zona2', 404], ['bruno', '/acesso', 404],
    ['carla', '/acesso', 200], ['carla', '/zona2', 404], ['carla', '/zona1/relatorios', 404],
    ['davi', '/zona2', 404], ['davi', '/zona1', 200],
  ]
  for (const [u, caminho, status] of casos) {
    const { cookie } = await entrar(u)
    const r = await pedir(caminho, { cookie })
    assert.equal(r.status, status, `${u} ${caminho}`)
    if (status === 404) assert.ok(!/sem acesso|não autorizado|acesso negado/i.test(r.html), 'placeholder de sem acesso (invariante 8)')
  }
})

test('N7: shell e zona 1 leem os proprios dominios (plataforma; A e B)', async () => {
  const { cookie } = await entrar('bruno')
  assert.match((await pedir('/', { cookie })).html, /Manutenção programada/)
  const z1 = (await pedir('/zona1', { cookie })).html
  assert.match(z1, /Disponibilidade/)      // domínio B
  assert.match(z1, /Recurso do financeiro/) // domínio A, escopo do bruno
})

test('perfil administrativo nao concede dado: carla nao ve custo nem r-3; bruno ve', async () => {
  const carla = (await entrar('carla')).cookie
  const bruno = (await entrar('bruno')).cookie
  const r1 = (await pedir('/zona1/recursos/r-1', { cookie: carla })).html
  assert.ok(!/CC-10|Custo/.test(r1), 'custo chegou ao HTML ou ao payload RSC da carla')
  assert.match((await pedir('/zona1/recursos/r-1', { cookie: bruno })).html, /CC-10/)
  assert.equal((await pedir('/zona1/recursos/r-3', { cookie: carla })).status, 404)
  assert.equal((await pedir('/zona1/recursos/r-3', { cookie: bruno })).status, 200)
})

test('V4 (auditor_b1_d1_3, E10c): nenhum CPF nem e-mail da semente chega ao HTML ou ao payload RSC de /acesso', async () => {
  const semente = JSON.parse(readFileSync(join(RAIZ, 'erp-dominio-stub', 'dados', 'semente', 'gestao-acesso-v2.json'), 'utf8'))
  const cpfs = semente.pessoas.map((p) => p.cpf).filter(Boolean)
  const emails = semente.pessoas.map((p) => p.emailFuncional).filter(Boolean)
  assert.ok(cpfs.length >= 4 && emails.length >= 4, 'semente sem CPF ou e-mail: o teste nao provaria nada')
  const carla = (await entrar('carla')).cookie
  const html = (await pedir('/acesso', { cookie: carla })).html
  const rsc = (await pedir('/acesso', { cookie: carla, cabecalhos: { rsc: '1' } })).html
  assert.match(html, /revogar|conceder/i, 'a pagina de acesso nao listou pessoas (o teste nao provaria nada)')
  for (const [nome, corpo] of [['HTML', html], ['RSC', rsc]]) {
    for (const v of [...cpfs, ...emails]) assert.ok(!corpo.includes(v), `${v} chegou ao ${nome} de /acesso`)
    assert.ok(!/"cpf"|\\"cpf\\"|emailFuncional/.test(corpo), `campo de cadastro chegou ao ${nome} de /acesso`)
  }
})

test('token nunca chega ao navegador, em nenhuma pagina', async () => {
  for (const u of Object.keys(MENUS)) {
    const { cookie } = await entrar(u)
    for (const caminho of ['/', '/zona1', '/zona1/relatorios', '/zona1/recursos/r-1', '/zona2', '/acesso']) {
      const { html } = await pedir(caminho, { cookie })
      assert.ok(!TOKEN.test(html) && !html.includes('accessToken'), `${u} ${caminho}`)
    }
  }
})

// Gestão de acesso v2: pessoas × módulos na zona de acesso (ADR-0014, adendo 1). Só o davi é revogado e
// reconcedido: o módulo zona1 é de concessão direta, e ele volta com o mesmo perfil padrão.
const ACAO_DE_ACESSO = (nome) => ({ app: 'erp-zona-acesso', arquivo: 'app/acesso/acoes.ts', nome, caminho: '/acesso' })
const DAVI = 'p-20'
const CARLA = 'p-19'
const formDeAcesso = async (carla, pessoa, modulo) => formularios((await pedir('/acesso', { cookie: carla })).html)
  .find((c) => c.pessoa === pessoa && c.modulo === modulo)

async function administrar(nome, campos, cookie) {
  assert.ok(campos, `formulario de ${nome} nao encontrado`)
  const r = await acaoPeloCliente({ ...ACAO_DE_ACESSO(nome), campos, cookie })
  assert.equal(r.status, 200)
  assert.equal(r.redirecionamento, null, 'nenhuma action usa redirect() (limitacao 11)')
  return r
}

test('N6/N5 e invariante 16 comportamental: revogar o acesso vale na proxima navegacao, sem novo login', async () => {
  const carla = (await entrar('carla')).cookie
  const davi = (await entrar('davi')).cookie
  assert.equal((await pedir('/zona1', { cookie: davi })).status, 200)

  const revogar = await formDeAcesso(carla, DAVI, 'zona1')
  assert.ok(revogar?.acesso, 'davi deveria ter acesso vigente a zona1')
  const r = await administrar('revogarAcesso', revogar, carla)
  assert.match(r.corpo, /"destino":"\/acesso"/)
  assert.ok(valorDoCookie(r.cookies, '__Host-flash'), 'toast de resultado')
  try {
    for (const caminho of ['/zona1', '/zona1/recursos/r-1']) assert.equal((await pedir(caminho, { cookie: davi })).status, 404, caminho)
    assert.ok(!menu((await pedir('/', { cookie: davi })).html).hrefs.includes('/zona1'))
  } finally {
    await administrar('concederAcesso', await formDeAcesso(carla, DAVI, 'zona1'), carla)
  }
  assert.equal((await pedir('/zona1/recursos/r-1', { cookie: davi })).status, 200)
})

test('segregacao: quem administra nao se concede modulo; o dominio recusa e nada muda', async () => {
  const carla = (await entrar('carla')).cookie
  const r = await administrar('concederAcesso', await formDeAcesso(carla, CARLA, 'zona2'), carla)
  assert.match(r.corpo, /"destino":"\/acesso"/)
  assert.equal((await pedir('/zona2', { cookie: carla })).status, 404, 'carla se concedeu a zona 2')
})

test('Server Action e reverificada no servidor: quem nao tem papel nao administra', async () => {
  const carla = (await entrar('carla')).cookie
  const bruno = (await entrar('bruno')).cookie
  const davi = (await entrar('davi')).cookie
  const r = await acaoPeloCliente({ ...ACAO_DE_ACESSO('concederAcesso'), campos: await formDeAcesso(carla, DAVI, 'zona2'), cookie: bruno })
  assert.match(r.corpo, /"destino":"\/"/, 'a action de administracao rodou para o bruno')
  assert.equal((await pedir('/zona2', { cookie: davi })).status, 404, 'o acesso mudou')
})

/** Toda Server Action de toda app, lida dos manifestos do build. */
function todasAsAcoes() {
  return ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso'].flatMap((app) => {
    const m = JSON.parse(readFileSync(join(RAIZ, app, '.next/server/server-reference-manifest.json'), 'utf8'))
    return Object.values(m.node).map(({ filename, exportedName }) => {
      const seg = (filename.includes('app/') ? filename.split('app/')[1] : filename).split('/')[0]
      return { app, arquivo: filename, nome: exportedName, caminho: '/' + seg }
    })
  })
}
/** Quem tem o módulo de cada app com action: sem a checagem de origem, a action rodaria. */
const DONO = { 'erp-zona-2': 'ana', 'erp-zona-acesso': 'carla' }

const CONCLUIR = { app: 'erp-zona-2', arquivo: 'app/zona2/acoes.ts', nome: 'concluirTarefa', caminho: '/zona2' }

/**
 * Campos VALIDOS de cada action, lidos do formulario que a propria pagina renderiza (auditor_b1_d1_3, V5):
 * com campos da v1, o dominio recusaria com 422 de qualquer jeito e o teste de Origin nao teria dentes.
 * Action nova sem entrada aqui reprova o teste.
 */
const CAMPOS_VALIDOS = {
  concluirTarefa: async () => formularios((await pedir('/zona2', { cookie: (await entrar('ana')).cookie })).html).find((c) => c.id === 't-2'),
  revogarAcesso: async () => formDeAcesso((await entrar('carla')).cookie, DAVI, 'zona1'),
  concederAcesso: async () => formDeAcesso((await entrar('carla')).cookie, DAVI, 'zona2'),
}

test('Server Action sem Origin, ou com Origin de outro site, nao executa em nenhuma app (campos validos, estado conferido)', async () => {
  const acoes = todasAsAcoes()
  assert.ok(acoes.length >= 3, `so ${acoes.length} actions encontradas`)
  for (const acao of acoes) {
    assert.ok(CAMPOS_VALIDOS[acao.nome], `action ${acao.app} ${acao.nome} sem campos validos neste teste`)
    const campos = await CAMPOS_VALIDOS[acao.nome]()
    assert.ok(campos, `${acao.nome}: formulario nao encontrado na pagina (o teste nao provaria nada)`)
    const cookie = (await entrar(DONO[acao.app] ?? 'carla')).cookie
    for (const origem of [null, 'http://evil.com']) {
      const r = await acaoPeloCliente({ ...acao, campos, cookie, origem })
      assert.ok(!valorDoCookie(r.cookies, '__Host-flash'), `${acao.app} ${acao.nome} rodou com Origin ${origem}`)
    }
  }
  // nada mudou no dominio: davi segue com a zona 1 e sem a zona 2; a tarefa segue pendente
  const davi = (await entrar('davi')).cookie
  assert.equal((await pedir('/zona1', { cookie: davi })).status, 200, 'revogacao executou sem Origin valido')
  assert.equal((await pedir('/zona2', { cookie: davi })).status, 404, 'concessao executou sem Origin valido')
  // zona 2 e modulo validado: a concessao ficaria pendente (sem 200); o estado se confere no dominio
  assert.ok(!(await formDeAcesso((await entrar('carla')).cookie, DAVI, 'zona2'))?.acesso, 'concessao pendente criada sem Origin valido')
  const ana = (await entrar('ana')).cookie
  assert.match((await pedir('/zona2', { cookie: ana })).html, /Conferir inventário(<!-- -->)? — (<!-- -->)?pendente/)
})

test('Server Action com Origin do shell e os mesmos campos executa (dentes do teste acima)', async () => {
  const carla = (await entrar('carla')).cookie
  const davi = (await entrar('davi')).cookie
  await administrar('concederAcesso', await CAMPOS_VALIDOS.concederAcesso(), carla)
  const criado = await formDeAcesso(carla, DAVI, 'zona2')
  try {
    // zona 2 e modulo validado: a concessao nasce pendente (vigente, revogavel), sem dar a zona ainda
    assert.ok(criado?.acesso, 'a concessao com Origin valido nao chegou ao dominio')
  } finally {
    if (criado?.acesso) await administrar('revogarAcesso', criado, carla)
  }
  assert.ok(!(await formDeAcesso(carla, DAVI, 'zona2'))?.acesso, 'a limpeza nao revogou')
  assert.equal((await pedir('/zona2', { cookie: davi })).status, 404)
})

test('N4: acao na zona 2 leva para a zona 1 e o toast aparece no documento seguinte, uma vez', async () => {
  const ana = (await entrar('ana')).cookie
  const campos = formularios((await pedir('/zona2', { cookie: ana })).html).find((c) => c.id === 't-1')
  assert.ok(campos, 'formulario da tarefa t-1')
  // a semente guarda t-1 na versao 3: o If-Match vem do que o cliente conhece, nunca fixo (invariante 6; P16)
  assert.equal(campos.versao, '3', 'a pagina deveria mandar a versao que conhece')
  const r = await acaoPeloCliente({ ...CONCLUIR, campos, cookie: ana })
  assert.equal(r.status, 200)
  // Sem redirect() da action: o Next buscaria /zona1 dentro do processo da zona 2 (limitação de Multi-Zones).
  assert.equal(r.redirecionamento, null)
  assert.match(r.corpo, /"destino":"\/zona1"/, 'a ilha recebe o destino e troca o documento')
  const flash = valorDoCookie(r.cookies, '__Host-flash')
  assert.ok(flash, 'cookie de flash')

  // Pote de cookies como o do navegador: o que a resposta apagar deixa de ser enviado.
  const pote = new Map([['__Host-session', ana.split('=')[1]], ['__Host-flash', flash]])
  const comPote = async (caminho) => {
    const r = await pedir(caminho, { cookie: [...pote].map(([k, v]) => `${k}=${v}`).join('; ') })
    for (const c of r.cookies) {
      const [par] = c.split(';'); const [k, v] = [par.slice(0, par.indexOf('=')), par.slice(par.indexOf('=') + 1)]
      if (/max-age=0/i.test(c)) pote.delete(k); else pote.set(k, v)
    }
    return r.html
  }
  const primeiro = await comPote('/zona1')
  assert.equal((primeiro.match(/moldura-toast-sucesso">Tarefa concluída\.</g) ?? []).length, 1)
  assert.ok(!pote.has('__Host-flash'), 'o proxy nao consumiu o flash')
  assert.ok(!(await comPote('/zona1')).includes('Tarefa concluída'), 'o toast reapareceu ao recarregar')
  assert.ok(!(await comPote('/zona2')).includes('Tarefa concluída'), 'o toast reapareceu em outra zona')
  assert.match((await pedir('/zona2', { cookie: ana })).html, /Revisar cadastro(<!-- -->)? — (<!-- -->)?concluída/)
})

test('invariante 16: toda Server Action de toda app recusa quem nao tem o modulo, antes de agir', async () => {
  const davi = (await entrar('davi')).cookie   // sem nenhum modulo com action
  let total = 0
  for (const app of ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const manifesto = JSON.parse(readFileSync(join(RAIZ, app, '.next/server/server-reference-manifest.json'), 'utf8'))
    for (const { filename, exportedName } of Object.values(manifesto.node)) {
      const seg = (filename.includes('app/') ? filename.split('app/')[1] : filename).split('/')[0]
      const caminho = '/' + seg
      const r = await acaoPeloCliente({ app, arquivo: filename, nome: exportedName, caminho, campos: { id: 't-2', versao: '1' }, cookie: davi })
      assert.match(r.corpo, /"destino":"\/"/, `${app} ${exportedName} nao reverificou o modulo`)
      total++
    }
  }
  assert.ok(total >= 3, `so ${total} actions encontradas`)
  const ana = (await entrar('ana')).cookie
  assert.match((await pedir('/zona2', { cookie: ana })).html, /Conferir inventário(<!-- -->)? — (<!-- -->)?pendente/)
})

test('D13 (L2/P07): ator com apenas tarefas.ver (eva) e recusado em concluirTarefa antes do dominio', async () => {
  const eva = (await entrar('eva')).cookie
  const pagina = await pedir('/zona2', { cookie: eva })
  assert.equal(pagina.status, 200, 'eva deveria conseguir ver /zona2')
  assert.ok(!pagina.html.includes('Concluir'), 'botao concluir nao deveria aparecer para eva (invariante 8)')
  const r = await acaoPeloCliente({ ...CONCLUIR, campos: { id: 't-2', versao: '1' }, cookie: eva })
  assert.equal(r.status, 200)
  assert.match(r.corpo, /"destino":"\/"/, 'eva sem tarefas.concluir deve ser recusada e redirecionada para /')
  const ana = (await entrar('ana')).cookie
  assert.match((await pedir('/zona2', { cookie: ana })).html, /Conferir inventário(<!-- -->)? — (<!-- -->)?pendente/)
})

test('invariante 12: sessao expirada numa action vira ida ao login, sem erro generico', async () => {
  const { cookie } = await entrar('ana')
  const campos = formularios((await pedir('/zona2', { cookie })).html).find((c) => c.id === 't-2')
  await pedir('/api/auth/sair', { metodo: 'POST', cookie })
  const r = await acaoPeloCliente({ ...CONCLUIR, campos, cookie })
  assert.equal(r.status, 200)
  assert.match(r.corpo, /"destino":"\/login\?de=%2Fzona2"/)
  const outra = (await entrar('ana')).cookie
  assert.match((await pedir('/zona2', { cookie: outra })).html, /Conferir inventário(<!-- -->)? — (<!-- -->)?pendente/)
})

test('o cabecalho interno de flash vindo do navegador e ignorado', async () => {
  const ana = (await entrar('ana')).cookie
  const falso = encodeURIComponent(JSON.stringify({ tipo: 'erro', texto: 'Forjado pelo cliente', id: 'x1' }))
  const r = await pedir('/zona1', { cookie: ana, cabecalhos: { 'x-erp-flash': falso } })
  assert.ok(!r.html.includes('Forjado pelo cliente'))
})

test('N3: sair no shell encerra a sessao em todas as zonas', async () => {
  const { cookie } = await entrar('ana')
  assert.equal((await pedir('/zona2', { cookie })).status, 200)
  const r = await pedir('/api/auth/sair', { metodo: 'POST', cookie })
  assert.equal(r.status, 303)
  assert.match(r.cookies.find((c) => c.startsWith('__Host-session=')) ?? '', /Max-Age=0/i)
  // o cookie antigo, como outra aba que ainda o tem: a camada 2 recusa em toda zona
  for (const caminho of ['/', '/zona1', '/zona2']) {
    const s = await pedir(caminho, { cookie })
    assert.equal(s.status, 307, caminho)
    assert.match(s.local ?? '', /^\/login/)
  }
})

test('N2 (logout CSRF): sair vindo de outro site da 403 com codigo e supportId, sem apagar cookie nem encerrar a sessao', async () => {
  const { cookie } = await entrar('ana')
  for (const [nome, cabecalhos, origem] of [
    ['Sec-Fetch-Site cross-site', { 'sec-fetch-site': 'cross-site' }, 'https://outro.exemplo'],
    ['Origin de outro site', {}, 'https://outro.exemplo'],
  ]) {
    const r = await pedir('/api/auth/sair', { metodo: 'POST', cookie, origem, cabecalhos })
    assert.equal(r.status, 403, nome)
    assert.deepEqual(r.cookies, [], `${nome}: apagou cookie`)
    assert.deepEqual(Object.keys(JSON.parse(r.html)).sort(), ['codigo', 'supportId'], nome)
  }
  assert.equal((await pedir('/zona2', { cookie })).status, 200, 'a sessao acabou com um pedido de outro site')
})

test('N2: o botao Sair do shell (formulario da mesma origem) encerra a sessao no navegador', {
  skip: acharChrome() ? false : COMO_CONSEGUIR_UM_NAVEGADOR,
}, async () => {
  const { id, cookie } = await entrar('ana')
  const { pagina, fechar } = await abrirNavegador()
  try {
    await pagina.cookie('__Host-session', id, SHELL_URL)
    await pagina.ir(`${SHELL_URL}/zona1`)
    assert.equal(await pagina.avaliar(`document.querySelectorAll('form[action="/api/auth/sair"] button').length`), 1, 'sem o botao Sair')
    pagina.pedidos.length = 0
    await pagina.avaliar(`document.querySelector('form[action="/api/auth/sair"] button').click()`)
    await pagina.esperarRede()
    assert.ok(pagina.pedidos.some((p) => new URL(p.url).pathname === '/api/auth/sair'), 'o clique nao enviou o formulario')
    // o 303 de sair não aparece como resposta no CDP (é redirecionamento); um 403 deixaria a página em /api/auth/sair
    assert.equal(await pagina.avaliar('location.pathname'), '/login')
  } finally { await fechar() }
  const s = await pedir('/zona1', { cookie })
  assert.equal(s.status, 307, 'a sessao continua valida depois do Sair')
})

test('cookie forjado passa da camada 1 e morre na camada 2', async () => {
  const r = await pedir('/zona1', { cookie: '__Host-session=00000000-0000-0000-0000-000000000000' })
  assert.equal(r.status, 307)
  assert.match(r.local ?? '', /^\/login/)
})

test('CSP com nonce em shell e zonas, e todo script marcado com ele', async () => {
  const { cookie } = await entrar('ana')
  for (const caminho of ['/', '/zona1', '/zona2']) {
    const r = await pedir(caminho, { cookie })
    const nonce = r.csp?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(nonce, `${caminho} sem CSP com nonce`)
    const scripts = [...r.html.matchAll(/<script([^>]*)>/g)]
    assert.ok(scripts.length > 0)
    for (const [, attrs] of scripts) assert.match(attrs, new RegExp(`nonce="${nonce}"`), `${caminho}: script sem nonce`)
  }
})

test('assets de cada zona vivem sob o prefixo dela e chegam pelo shell', async () => {
  const { cookie } = await entrar('ana')
  for (const [caminho, prefixo] of [['/zona1', '/zona1-static/_next/'], ['/zona2', '/zona2-static/_next/']]) {
    const html = (await pedir(caminho, { cookie })).html
    const asset = html.match(new RegExp(`${prefixo}[^"]+\\.js`))?.[0]
    assert.ok(asset, `${caminho} nao referencia ${prefixo}`)
    assert.equal((await pedir(asset)).status, 200, asset)
  }
})

test('N3 estatico: nenhuma zona monta store de escrita, identidade ou grava o cookie de sessao', () => {
  const fontes = (d) => readdirSync(d).flatMap((n) => {
    if (['node_modules', '.next'].includes(n)) return []
    const p = join(d, n)
    return statSync(p).isDirectory() ? fontes(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
  for (const zona of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    for (const f of fontes(join(RAIZ, zona))) {
      const t = readFileSync(f, 'utf8')
      // Estrutural: escrita de sessao e autenticacao so existem em @erp/nucleo/shell (invariante 15).
      assert.ok(!/@erp\/nucleo\/shell/.test(t), `${f} importa o subpath de escrita do shell`)
      assert.ok(!/@erp\/nucleo\/(dist|src)/.test(t), `${f} contorna os exports do nucleo`)
      // o nome do cookie de sessao so pode aparecer numa leitura
      for (const m of t.matchAll(/__Host-session/g)) {
        assert.match(t.slice(Math.max(0, m.index - 6), m.index + 16), /\.get\('__Host-session'\)/, `${f} usa o cookie de sessao fora de uma leitura`)
      }
    }
  }
})

test('V1 estatico: o cliente Redis das zonas so le (sem set, del nem outro comando de escrita)', () => {
  const fontes = (d) => readdirSync(d).flatMap((n) => {
    if (['node_modules', '.next'].includes(n)) return []
    const p = join(d, n)
    return statSync(p).isDirectory() ? fontes(p) : /\.(ts|tsx|mjs|js)$/.test(n) ? [p] : []
  })
  for (const zona of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    // sem comentarios: o auditor_b1_d1_3 (V1) satisfez a checagem com REDIS_URL_ZONA num comentario
    const cliente = readFileSync(join(RAIZ, zona, 'lib', 'redis.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    assert.match(cliente, /ClienteRedisDeLeitura/, `${zona}: cliente sem o tipo so de leitura`)
    assert.match(cliente, /process\.env\.REDIS_URL_ZONA\b/, `${zona}: nao usa o usuario de leitura`)
    assert.ok(!/(\?\?|\|\|)\s*process\.env\.REDIS_URL\b(?!_)/.test(cliente), `${zona}: cai na credencial de escrita do shell sem REDIS_URL_ZONA`)
    assert.ok(!/\b(set|del|unlink|expire|pexpire|getdel|getex|rename|flushall|flushdb|sendCommand|multi|eval)\b/i.test(cliente.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')),
      `${zona}: lib/redis.ts expoe comando alem de get`)
    for (const f of fontes(join(RAIZ, zona))) {
      if (f.endsWith(join('lib', 'redis.ts'))) continue
      assert.ok(!/from ['"](redis|ioredis|@redis\/[a-z-]+)['"]|require\(['"](redis|ioredis)/.test(readFileSync(f, 'utf8')), `${f} fala com o Redis fora de lib/redis.ts`)
    }
  }
})

/** Conexões abertas no Redis (id, usuário, último comando), sem a própria conexão de quem pergunta. */
async function conexoesRedis() {
  const lista = await redisCru(process.env.REDIS_URL, [['CLIENT', 'LIST']])
  return lista.split('\n').filter((l) => l.startsWith('id=') && !/ cmd=client\|list /.test(l)).map((l) => ({
    id: l.match(/^id=(\d+)/)[1], usuario: l.match(/ user=(\S+)/)[1], cmd: l.match(/ cmd=(\S+)/)[1], idade: l.match(/ age=(\d+)/)[1],
  }))
}

test('V1 dinamico: com a ACL do showcase, o usuario das zonas nao grava nem apaga sessao', { skip: !process.env.REDIS_URL_ZONA && 'so no modo Redis (task verificar:redis)' }, async () => {
  const r = await redisCru(process.env.REDIS_URL_ZONA, [['SET', 'erp:sessao:forjada', '{}'], ['DEL', 'erp:sessao:qualquer']])
  assert.match(r, /^\+OK/, 'AUTH do usuario da zona falhou')
  assert.equal((r.match(/NOPERM/g) ?? []).length, 2, `a zona conseguiu escrever: ${r}`)
})

test('V1 (challenger_b1_d1_7): so o endereco do Redis nao grava sessao; a escrita exige a senha do shell', { skip: !process.env.REDIS_URL_ZONA && 'so no modo Redis (task verificar:redis)' }, async () => {
  const anonimo = new URL(process.env.REDIS_URL)
  anonimo.username = ''
  anonimo.password = ''
  const r = await redisCru(anonimo.href, [['SET', 'erp:sessao:forjada-anonima', '{}']])
  assert.match(r, /NOAUTH/, `conexao sem senha gravou no Redis: ${r}`)
  const conferir = await redisCru(process.env.REDIS_URL, [['EXISTS', 'erp:sessao:forjada-anonima']])
  assert.match(conferir, /:0\r\n/, 'a chave forjada existe')
  for (const [nome, proc] of [...ambiente.dominios]) {
    assert.ok(!readFileSync(`/proc/${proc.pid}/environ`, 'utf8').includes('REDIS_URL'), `dominio ${nome} recebeu credencial do Redis`)
  }
})

test('V1 (auditor_b1_d1_3): no ar, as zonas conectam ao Redis so com o usuario de leitura', { skip: !process.env.REDIS_URL_ZONA && 'so no modo Redis (task verificar:redis)' }, async () => {
  const ana = (await entrar('ana')).cookie
  const carla = (await entrar('carla')).cookie
  // O shell abre mais de uma conexao de escrita (rota e pagina sao instancias de modulo separadas), entao
  // contar nao separa processos. Derrubam-se as conexoes `default` (o shell reconecta sozinho, ocioso) e
  // as zonas sao chamadas direto na porta delas, sem passar pelo shell: nenhuma conexao `default` pode
  // surgir nem executar comando nesse intervalo.
  await redisCru(process.env.REDIS_URL, [['CLIENT', 'KILL', 'USER', 'default', 'SKIPME', 'yes']])
  await new Promise((ok) => setTimeout(ok, 500))
  const antes = new Map((await conexoesRedis()).filter((c) => c.usuario === 'default').map((c) => [c.id, c.cmd]))
  for (const [cookie, url] of [[ana, 'http://localhost:3001/zona1'], [ana, 'http://localhost:3002/zona2'], [carla, 'http://localhost:3003/acesso']]) {
    const r = await fetch(url, { headers: { cookie }, redirect: 'manual' })
    await r.text()
    assert.equal(r.status, 200, url)
  }
  const depois = await conexoesRedis()
  const suspeitas = depois.filter((c) => c.usuario === 'default' && antes.get(c.id) !== c.cmd)
  assert.deepEqual(suspeitas, [], `uma zona usou a credencial de escrita: ${JSON.stringify(depois)}`)
  assert.ok(depois.filter((c) => c.usuario === 'zona').length >= 3, `alguma zona nao conectou com o usuario de leitura: ${JSON.stringify(depois)}`)
  // o shell segue funcionando depois de perder as conexoes
  assert.equal((await pedir('/', { cookie: ana })).status, 200)
})

test('V1 (auditor_b1_d1_3): zona com REDIS_URL e sem REDIS_URL_ZONA nao le sessao nem conecta como o shell', { skip: !process.env.REDIS_URL_ZONA && 'so no modo Redis (task verificar:redis)', timeout: 90_000 }, async () => {
  const { cookie } = await entrar('ana')
  const antes = new Set((await conexoesRedis()).filter((c) => c.usuario === 'default').map((c) => c.id))
  // a zona nunca recebe REDIS_URL (K4, V1); aqui ela é posta de propósito, para provar a recusa do produto
  assert.ok(process.env.REDIS_URL, 'modo Redis sem REDIS_URL no ambiente da verificacao')
  const derrubar = await ambiente.subirAppAvulsa('erp-zona-2', { porta: 3012, envExtra: { REDIS_URL_ZONA: null, REDIS_URL: process.env.REDIS_URL }, caminho: '/zona2/api/health' })
  try {
    const r = await fetch('http://localhost:3012/zona2', { headers: { cookie }, redirect: 'manual' })
    await r.text()
    assert.ok(r.status >= 500, `a zona sem REDIS_URL_ZONA respondeu ${r.status}`)
    const novas = (await conexoesRedis()).filter((c) => c.usuario === 'default' && !antes.has(c.id))
    assert.deepEqual(novas, [], 'a zona conectou com a credencial de escrita do shell')
  } finally {
    await derrubar()
  }
})

test('L1 (auditor_b1_d1_3, E05): /{zona}/api/health nao toca dominio nem sessao e responde corpo fixo', async () => {
  for (const [app, zona, porta] of [['erp-zona-1', 'zona1', 3001], ['erp-zona-2', 'zona2', 3002], ['erp-zona-acesso', 'acesso', 3003]]) {
    const fonte = readFileSync(join(RAIZ, app, 'app', zona, 'api', 'health', 'route.ts'), 'utf8')
    assert.ok(!/\bimport\b|\brequire\s*\(|nucleo|process\.env|fetch|cookies|headers\(/.test(fonte), `${app}: health importa ou le algo`)
    // a sonda do shell pergunta a zona direto, sem cookie (rota publica da zona)
    const r = await fetch(`http://localhost:${porta}/${zona}/api/health`, { redirect: 'manual' })
    assert.equal(r.status, 200, zona)
    assert.deepEqual(await r.json(), { status: 'ok' }, `${zona}: health devolve mais que o estado`)
    // pelo shell, sem sessao, nao e alcancavel (invariante 10)
    assert.equal((await fetch(`${SHELL_URL}/${zona}/api/health`, { redirect: 'manual' })).status, 307, `${zona}: health exposto pelo shell`)
  }
})

test('P12: toda zona aceita Server Action so dos hosts do shell (SHELL_HOSTS), nunca uma lista escrita no codigo', async () => {
  // Uma leitura so por zona (lib/hosts-do-shell.ts), com trim como no shell: `SHELL_HOSTS='a, b'` passa
  // nas paginas e no allowedOrigins do Next (I1 da revisao da Task 3 do D19-B).
  for (const app of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const pagina = readFileSync(join(RAIZ, app, 'lib', 'pagina.ts'), 'utf8')
    const config = readFileSync(join(RAIZ, app, 'next.config.ts'), 'utf8')
    assert.match(pagina, /hostsPermitidos:\s*lerHostsDoShell\(\s*\)/, `${app}: hostsPermitidos`)
    assert.match(config, /allowedOrigins:\s*lerHostsDoShell\(\s*\)/, `${app}: allowedOrigins`)
    for (const [nome, fonte] of [['lib/pagina.ts', pagina], ['next.config.ts', config]]) {
      assert.doesNotMatch(fonte, /SHELL_HOSTS|\.split\(/, `${app}/${nome}: le SHELL_HOSTS por conta propria`)
    }
    const { lerHostsDoShell } = await import(pathToFileURL(join(RAIZ, app, 'lib', 'hosts-do-shell.ts')).href)
    assert.deepEqual(lerHostsDoShell(undefined), ['localhost:3000'], app)
    assert.deepEqual(lerHostsDoShell('erp.exemplo, b.exemplo:8443 ,,'), ['erp.exemplo', 'b.exemplo:8443'], app)
  }
})

test('invariante 16 estatico: toda pagina de zona exige modulo e funcionalidade; a zona de acesso, papel; o shell consulta o acesso', () => {
  // `(publico)` so e pulado no shell (login); nas zonas toda pagina e de modulo
  const exigido = {
    'erp-shell': /await Promise\.all\(\[\s*modulosPermitidos\(\)/,   // D4: fail-closed pela consulta
    'erp-zona-1': /await exigirModulo\('zona1', '[a-z0-9-]+\.[a-z0-9-]+'\)/,
    'erp-zona-2': /await exigirModulo\('zona2', '[a-z0-9-]+\.[a-z0-9-]+'\)/,
    'erp-zona-acesso': /await exigirPapel\(\)/,
  }
  let total = 0
  for (const [app, padrao] of Object.entries(exigido)) {
    for (const { arquivo } of paginasDaApp(app, { pularPublico: app === 'erp-shell' })) {
      assert.match(readFileSync(arquivo, 'utf8'), padrao, `${arquivo} sem a verificacao de acesso`)
      total++
    }
  }
  assert.ok(total >= 6)
})

test('toda funcionalidade que a zona exige esta no manifesto dela (e o id do modulo e o da zona)', async () => {
  const fontes = (d) => readdirSync(d).flatMap((n) => {
    if (['node_modules', '.next'].includes(n)) return []
    const p = join(d, n)
    return statSync(p).isDirectory() ? fontes(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
  for (const [app, zona] of [['erp-zona-1', 'zona1'], ['erp-zona-2', 'zona2']]) {
    const manifesto = readFileSync(join(RAIZ, app, 'acesso.manifesto.ts'), 'utf8')
    assert.match(manifesto, new RegExp(`id: '${zona}'`))
    const declaradas = [...manifesto.match(/funcionalidades: \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    let usadas = 0
    for (const f of fontes(join(RAIZ, app, 'app'))) {
      const t = readFileSync(f, 'utf8')
      for (const m of t.matchAll(/(?:exigirModulo\('|modulo: ')([a-z0-9-]+)'(?:, | *, *funcionalidade: )'([a-z0-9.-]+)'/g)) {
        assert.equal(m[1], zona, `${f} exige modulo de outra zona`)
        assert.ok(declaradas.includes(m[2]), `${f} exige ${m[2]}, fora do manifesto de ${zona}`)
        usadas++
      }
    }
    assert.ok(usadas > 0, `nenhuma exigencia achada em ${app}`)
  }
})

test('N8: nenhuma app faz saida de rede fora do registro de destinos (analise estrutural)', () => {
  // saida-de-rede.mjs le a estrutura do codigo com o compilador do TypeScript: pega fetch escrito
  // de qualquer jeito, modulos de rede, eval/Function. Excecoes declaradas e justificadas la.
  assert.deepEqual(varrerAplicacoes(), [])
})

test('D5: dominio de negocio fora apaga so o bloco dele', async () => {
  const bruno = (await entrar('bruno')).cookie
  await ambiente.derrubarDominio('dominio-b')
  try {
    const r = await pedir('/zona1', { cookie: bruno })
    assert.equal(r.status, 200)
    assert.match(r.html, /Indicadores indisponíveis no momento/)
    assert.match(r.html, /Recurso do financeiro/)
  } finally { await ambiente.subirDominio('dominio-b') }
  await ambiente.derrubarDominio('dominio-a')
  try {
    const r = await pedir('/zona1', { cookie: bruno })
    assert.equal(r.status, 200)
    assert.match(r.html, /Recursos indisponíveis no momento/)
    assert.match(r.html, /Disponibilidade/)
  } finally { await ambiente.subirDominio('dominio-a') }
  await ambiente.derrubarDominio('plataforma')
  try {
    const r = await pedir('/', { cookie: bruno })
    assert.equal(r.status, 200)
    assert.match(r.html, /Avisos indisponíveis no momento/)
  } finally { await ambiente.subirDominio('plataforma') }
})

test('D4: gestao de acesso fora da a pagina de servico indisponivel, sem detalhe interno', async () => {
  const ana = (await entrar('ana')).cookie
  await ambiente.derrubarDominio('gestao-acesso-v2')
  try {
    for (const caminho of ['/', '/zona1', '/zona2']) {
      const r = await pedir(caminho, { cookie: ana })
      // no HTML do servidor, sem depender de JavaScript; o status fica 200 (o layout não o define)
      assert.match(r.html, /<h1>Serviço indisponível<\/h1>/, caminho)
      assert.ok(!r.html.includes('Olá,') && !r.html.includes('Painel da zona 1</h1>'), `${caminho} renderizou a pagina sem acesso`)
      assert.ok(!/ECONNREFUSED|at [A-Za-z]+ \(|node:internal|DestinoInvalido|ErroDeAplicacao/.test(r.html), `${caminho} vaza detalhe`)
    }
  } finally { await ambiente.subirDominio('gestao-acesso-v2') }
  assert.equal((await pedir('/zona1', { cookie: ana })).status, 200, 'voltou depois de reenviar os manifestos')
})

// ---------------------------------------------------------------------------------------------
// Gate "Shell novo", iteração 1: testes mínimos do auditor_shell_1 (.agents/auditor_shell_1/),
// cada um reprovando uma mutação que antes deixava todas as suítes verdes.

// L1 visitava só a zona 1; o auditor_shell_2 voltou o fail-open só na zona 2 e tudo ficou verde (G1).
// Agora toda página de módulo de toda zona, para quem tem e quem não tem o módulo.
const CONTEUDO_DE_MODULO = {
  '/zona1': /Painel da zona 1|recursos no seu escopo/,
  '/zona1/relatorios': /Relatórios|com custo/,
  '/zona2': /Conferir inventário|Revisar cadastro|Concluir e ir/,
  '/acesso': /Acesso a módulos —/,
  // o auditor_shell_3 voltou o fail-open só no detalhe do recurso e tudo ficou verde (V1)
  '/zona1/recursos/r-1': /Identificador:|CC-10/,
}

test('L1 cobre toda pagina de modulo das zonas: pagina nova sem entrada aqui reprova', () => {
  // O shell fica de fora de proposito: a pagina dele chama modulosPermitidos() de novo e lanca
  // com a gestao de acesso fora (equivalencia provada pelo auditor_shell_3). Nas zonas nenhuma pagina
  // e publica, entao `(publico)` nao e pulado.
  // A chave tem de ser uma URL que o Next serve pela PROPRIA pagina: numa rota dinamica, uma chave que
  // uma pagina mais especifica (menos segmentos dinamicos) tambem casa e servida por ela, nao pela
  // dinamica (auditor_shell_4: `/zona1/[secao]` passava pela chave `/zona1/relatorios`).
  for (const app of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const paginas = paginasDaApp(app, { pularPublico: false })
    for (const p of paginas) {
      const servidaPorEla = (url) => padraoDaRota(p.rota).test(url) &&
        !paginas.some((o) => o !== p && o.dinamicos < p.dinamicos && padraoDaRota(o.rota).test(url))
      assert.ok(Object.keys(CONTEUDO_DE_MODULO).some(servidaPorEla), `${p.rota} (${p.arquivo}) sem entrada em CONTEUDO_DE_MODULO que o Next sirva por ela`)
    }
  }
})

test('completude: o padrao de rota distingue pagina dinamica de literal irma (dentes do teste acima)', () => {
  const paginas = [{ rota: '/zona1/relatorios', dinamicos: 0 }, { rota: '/zona1/[secao]', dinamicos: 1 }]
  const [literal, dinamica] = paginas
  const servida = (p, url) => padraoDaRota(p.rota).test(url) && !paginas.some((o) => o !== p && o.dinamicos < p.dinamicos && padraoDaRota(o.rota).test(url))
  assert.equal(servida(dinamica, '/zona1/relatorios'), false)
  assert.equal(servida(dinamica, '/zona1/outra'), true)
  assert.equal(servida(literal, '/zona1/relatorios'), true)
  assert.ok(padraoDaRota('/zona1/[...resto]').test('/zona1/a/b'))
  assert.ok(padraoDaRota('/zona1/[[...resto]]').test('/zona1'))
})
test('L1/V1: gestao de acesso fora nao entrega pagina de modulo de nenhuma zona, nem no payload RSC', async () => {
  const quem = {}
  for (const u of ['davi', 'bruno', 'ana', 'carla']) quem[u] = (await entrar(u)).cookie
  await ambiente.derrubarDominio('gestao-acesso-v2')
  try {
    for (const [u, cookie] of Object.entries(quem)) {
      for (const [c, conteudo] of Object.entries(CONTEUDO_DE_MODULO)) {
        const r = await pedir(c, { cookie })
        assert.ok(!conteudo.test(r.html), `${u} ${c}: conteudo do modulo chegou com a gestao de acesso fora`)
      }
    }
  } finally { await ambiente.subirDominio('gestao-acesso-v2') }
})

test('L1 tem dentes: com a gestao de acesso no ar, quem tem o modulo ve o conteudo que L1 procura', async () => {
  // sem isto, um texto errado em CONTEUDO_DE_MODULO faria o L1 passar sem provar nada
  const donos = { '/zona1': 'davi', '/zona1/relatorios': 'bruno', '/zona2': 'ana', '/acesso': 'carla', '/zona1/recursos/r-1': 'bruno' }
  for (const [c, u] of Object.entries(donos)) {
    const r = await pedir(c, { cookie: (await entrar(u)).cookie })
    assert.match(r.html, CONTEUDO_DE_MODULO[c], `${u} nao viu ${c}`)
  }
})

test('L3: cabecalho de flash forjado pelo cliente nao aparece nas paginas do proprio shell', async () => {
  const ana = (await entrar('ana')).cookie
  const falso = encodeURIComponent(JSON.stringify({ tipo: 'erro', texto: 'Forjado pelo cliente', id: 'x1' }))
  const r = await pedir('/', { cookie: ana, cabecalhos: { 'x-erp-flash': falso } })
  assert.ok(!r.html.includes('Forjado pelo cliente'))
})

test('L4/V2: telemetria descarta lote anonimo sem repassar; 413 em streaming; 429 no 61o lote', async () => {
  const post = (cookie, body) => fetch(`${SHELL_URL}/api/otel/v1/traces`, {
    method: 'POST', body, duplex: 'half',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  })
  lotesNoColetor.length = 0
  assert.equal((await post(null, '{}')).status, 204)
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(lotesNoColetor.length, 0, 'lote sem sessao foi repassado ao coletor')
  const bruno = (await entrar('bruno')).cookie
  lotesNoColetor.length = 0
  assert.equal((await post(bruno, 'isto nao e json')).status, 400, 'corpo nao-JSON deveria dar 400')
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(lotesNoColetor.length, 0, 'corpo nao-JSON foi repassado ao coletor')
  assert.equal((await post(bruno, '{"ok":1}')).status, 204)
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(lotesNoColetor.length, 1, 'lote com sessao nao chegou ao coletor')
  // corpo em streaming, sem Content-Length: 413. Que o limite vale durante a leitura (sem ler tudo
  // antes) so a unidade de lerComLimite prova; pelo HTTP o fetch so entrega a resposta depois do envio
  const grande = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(300 * 1024)); c.close() } })
  assert.equal((await post(bruno, grande)).status, 413)
  const carla = (await entrar('carla')).cookie
  lotesNoColetor.length = 0
  let ultimo
  for (let i = 0; i < 61; i++) ultimo = await post(carla, '{}')
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(ultimo.status, 429)
  assert.equal(lotesNoColetor.length, 60, `o lote recusado por taxa chegou ao coletor (${lotesNoColetor.length})`)
  assert.equal(ultimo.headers.get('retry-after'), '60')
})

test('L2/V3/C1: zona fora da 503 proprio, em qualquer caixa; as outras seguem; ela volta', async () => {
  const ana = (await entrar('ana')).cookie
  await ambiente.derrubarApp('erp-zona-2')
  try {
    await new Promise((r) => setTimeout(r, 1200))   // passa do TTL de 1 s da sonda
    for (const c of ['/zona2', '/zona2/x', '/ZONA2', '/Zona2/x']) {
      const r = await fetch(`${SHELL_URL}${c}`, { headers: { cookie: ana }, redirect: 'manual' })
      assert.equal(r.status, 503, c)
      assert.equal(r.headers.get('retry-after'), '5', c)
      assert.equal(r.headers.get('cache-control'), 'no-store', c)
      assert.match(await r.text(), /indispon/i, c)
    }
    for (const c of ['/', '/zona1']) assert.equal((await pedir(c, { cookie: ana })).status, 200, c)
  } finally { await ambiente.subirApp('erp-zona-2') }
  const t0 = Date.now()
  let st = 0
  while (Date.now() - t0 < 5_000 && st !== 200) {
    st = (await pedir('/zona2', { cookie: ana })).status
    if (st !== 200) await new Promise((r) => setTimeout(r, 100))
  }
  assert.equal(st, 200, 'a zona 2 nao voltou em 5 s depois de reerguida')
})

test('L7 (auditor_shell_3, V2): zona travada (aceita conexao e nao responde) vira 503 em menos de 1 s', { timeout: 30_000 }, async () => {
  // L2 usa SIGKILL, que recusa a conexao na hora: sem isto, a sonda do proxy sem timeout passava
  const ana = (await entrar('ana')).cookie
  ambiente.congelarApp('erp-zona-2')
  try {
    await new Promise((r) => setTimeout(r, 1200))   // passa do TTL de 1 s da sonda
    const t0 = Date.now()
    const r = await fetch(`${SHELL_URL}/zona2`, { headers: { cookie: ana }, redirect: 'manual', signal: AbortSignal.timeout(5000) })
      .catch((e) => ({ status: `sem resposta (${e.name})` }))
    const ms = Date.now() - t0
    assert.equal(r.status, 503, `status ${r.status} em ${ms} ms`)
    // sonda de 500 ms (ERP_SONDA_TIMEOUT_MS); 1 s pega uma sonda lenta de 1,5 s (auditor_shell_4, G14)
    assert.ok(ms < 1000, `levou ${ms} ms`)
  } finally { ambiente.descongelarApp('erp-zona-2') }
  // a zona volta a responder antes do proximo teste
  const t0 = Date.now()
  let st = 0
  while (Date.now() - t0 < 5_000 && st !== 200) {
    st = (await pedir('/zona2', { cookie: ana })).status
    if (st !== 200) await new Promise((r) => setTimeout(r, 100))
  }
  assert.equal(st, 200, 'a zona 2 nao voltou em 5 s depois de descongelada')
})

test('L9 (D7): zona que trava com a sonda ainda valida solta a requisicao no teto (ERP_ZONA_TETO_MS), nao nos 30 s do Next', { timeout: 90_000 }, async () => {
  const teto = Number(process.env.ERP_ZONA_TETO_MS)
  const ana = (await entrar('ana')).cookie
  const zonaVolta = async () => {
    const t0 = Date.now()
    let st = 0
    while (Date.now() - t0 < 5_000 && st !== 200) {
      st = (await pedir('/zona2', { cookie: ana })).status
      if (st !== 200) await new Promise((r) => setTimeout(r, 100))
    }
    assert.equal(st, 200, 'a zona 2 nao voltou em 5 s depois de descongelada')
  }
  // A requisição precisa passar pela sonda ainda boa (cache de 1 s) e chegar à zona já congelada. Se o cache vencer entre
  // o 200 e o congelamento, a sonda pega a zona e responde 503 em < 1 s (isso é o L7): tenta de novo.
  let segurada
  try {
    for (let i = 0; i < 3 && !segurada; i++) {
      await zonaVolta()
      ambiente.congelarApp('erp-zona-2')
      const t0 = Date.now()
      const r = await fetch(`${SHELL_URL}/zona2`, { headers: { cookie: ana }, redirect: 'manual', signal: AbortSignal.timeout(teto + 10_000) })
        .catch((e) => ({ status: `sem resposta (${e.name})` }))
      const ms = Date.now() - t0
      ambiente.descongelarApp('erp-zona-2')
      if (ms >= 2_000) segurada = { status: r.status, ms, html: r.text ? await r.text() : '', cache: r.headers?.get('cache-control') }
    }
  } finally { ambiente.descongelarApp('erp-zona-2') }
  await zonaVolta()
  assert.ok(segurada, 'em 3 tentativas nenhuma requisicao chegou a zona congelada com a sonda ainda valida')
  // C3 (ADR-0015, decisão 7): o documento vai pelo gateway, que no teto responde a página da base com supportId
  assert.equal(segurada.status, 503, `status ${segurada.status} em ${segurada.ms} ms`)
  assert.match(segurada.html, /Zona temporariamente indisponível/)
  assert.match(segurada.html, /data-support-id="[0-9a-f-]{36}"/, 'a pagina da base sem supportId')
  assert.equal(segurada.cache, 'no-store')
  assert.ok(segurada.ms >= teto - 500, `soltou em ${segurada.ms} ms, antes do teto de ${teto} ms`)
  assert.ok(segurada.ms < teto + 2_000, `soltou em ${segurada.ms} ms; teto ${teto} ms (sem o D7 seriam ~30 s)`)
  console.log(`# L9: pagina da base em ${segurada.ms} ms (teto ${teto} ms)`)
})

/** A zona 9 de teste no ar, com a rota registrada e já roteada pelo shell (espera até 3 TTLs do mapa). */
async function zona9DeTeste(cookie) {
  zona9 ??= await subirZonaDeTeste({ id: 'zona9', porta: 3009, hosts: ['127.0.0.1', '127.0.0.2'] })
  assert.equal(await zona9.registrar('zona9'), 200)
  const ttl = Number(process.env.ERP_MAPA_ZONAS_TTL_MS)
  const t0 = Date.now()
  let r
  while (Date.now() - t0 < 3 * ttl + 2_000) {
    r = await pedir('/zona9', { cookie })
    if (r.status === 200 && r.html.includes(zona9.marca)) return { ms: Date.now() - t0 }
    await new Promise((ok) => setTimeout(ok, 100))
  }
  assert.fail(`a zona 9 nao passou a responder pelo shell em ${3 * ttl + 2_000} ms (ultimo status ${r?.status})`)
}

test('L9b (C3): pagina com varias chamadas lentas em sequencia, sem mandar bytes, recebe a pagina da base no teto', { timeout: 60_000 }, async () => {
  const teto = Number(process.env.ERP_ZONA_TETO_MS)
  const ana = (await entrar('ana')).cookie
  await zona9DeTeste(ana)
  // 3 chamadas de 2,5 s: cada uma abaixo do timeout de destino (5 s), a soma (7,5 s) acima do teto (6 s)
  const caminho = '/zona9/lenta-em-sequencia?passos=3&ms=2500'
  const t0 = Date.now()
  const r = await fetch(`${SHELL_URL}${caminho}`, { headers: { cookie: ana }, redirect: 'manual', signal: AbortSignal.timeout(teto + 10_000) })
  const ms = Date.now() - t0
  const html = await r.text()
  assert.equal(r.status, 503, `status ${r.status} em ${ms} ms`)
  assert.match(html, /data-support-id="[0-9a-f-]{36}"/)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  assert.ok(ms >= teto - 500 && ms < teto + 2_000, `pagina em ${ms} ms; teto ${teto} ms`)
  // o gateway soltou a conexao com a zona no teto, nao quando a pagina lenta terminou
  const reg = zona9.recebidas.findLast((x) => x.caminho === '/zona9/lenta-em-sequencia')
  assert.ok(reg, 'a zona nao recebeu o pedido')
  await new Promise((ok) => setTimeout(ok, 300))
  assert.ok(reg.fechouEm !== null && reg.fechouEm - reg.inicio < teto + 1_000, `a conexao com a zona ficou aberta (${reg.fechouEm && reg.fechouEm - reg.inicio} ms)`)
  console.log(`# L9b: pagina da base em ${ms} ms (teto ${teto} ms)`)
})

test('L9c (C3): zona que manda os cabecalhos e trava no meio e cortada por ociosidade (ERP_ZONA_OCIOSIDADE_MS)', { timeout: 60_000 }, async () => {
  const ocio = Number(process.env.ERP_ZONA_OCIOSIDADE_MS)
  const ana = (await entrar('ana')).cookie
  await zona9DeTeste(ana)
  const t0 = Date.now()
  const r = await fetch(`${SHELL_URL}/zona9/trava-no-meio`, { headers: { cookie: ana }, redirect: 'manual', signal: AbortSignal.timeout(ocio + 20_000) })
  const cabecalhosEm = Date.now() - t0
  assert.equal(r.status, 200, 'o status da zona ja saiu com os cabecalhos')
  const leitor = r.body.getReader()
  const dec = new TextDecoder()
  let corpo = ''
  let erro = null
  try {
    for (;;) { const { done, value } = await leitor.read(); if (done) break; corpo += dec.decode(value, { stream: true }) }
  } catch (e) { erro = e }
  const cortadoEm = Date.now() - t0
  assert.ok(erro, 'a resposta parada terminou como se estivesse completa')
  assert.match(corpo, /primeiro pedaco/, 'o primeiro pedaco nao chegou ao navegador')
  assert.doesNotMatch(corpo, /indispon/i, 'pagina da base depois do status: nao ha como')
  const parada = cortadoEm - cabecalhosEm
  assert.ok(parada >= ocio - 500 && parada < ocio + 3_000, `cortou ${parada} ms depois dos cabecalhos; ociosidade ${ocio} ms`)
  const reg = zona9.recebidas.findLast((x) => x.caminho === '/zona9/trava-no-meio')
  await new Promise((ok) => setTimeout(ok, 300))
  assert.ok(reg?.fechouEm, 'a conexao com a zona ficou aberta depois do corte')
  console.log(`# L9c: cabecalhos em ${cabecalhosEm} ms; corte por ociosidade ${parada} ms depois (ERP_ZONA_OCIOSIDADE_MS ${ocio})`)
})

test('L10 (C3): zona nova registrada passa a responder pelo shell em ate um TTL, sem reiniciar; removida, volta a 404', { timeout: 60_000 }, async () => {
  const ttl = Number(process.env.ERP_MAPA_ZONAS_TTL_MS)
  const ana = (await entrar('ana')).cookie
  zona9 ??= await subirZonaDeTeste({ id: 'zona9', porta: 3009, hosts: ['127.0.0.1', '127.0.0.2'] })
  // estado inicial conhecido: sem a rota, e o shell ja sabe disso
  // a releitura nao bloqueia: a primeira requisicao depois do TTL ainda ve o mapa antigo, entao espera o 404
  await zona9.remover('zona9')
  const ate404 = async () => {
    const t = Date.now()
    let st = 200
    while (Date.now() - t < 2 * ttl + 2_000 && st !== 404) {
      st = (await pedir('/zona9', { cookie: ana })).status
      if (st !== 404) await new Promise((ok) => setTimeout(ok, 100))
    }
    return { st, ms: Date.now() - t }
  }
  assert.equal((await ate404()).st, 404, 'zona sem rota registrada respondeu')
  const pid = ambiente.apps.get('erp-shell').pid

  const { ms } = await zona9DeTeste(ana)
  // releitura sem bloquear: a primeira requisição depois do TTL ainda usa o mapa antigo e dispara a releitura;
  // na prática TTL mais uma releitura, e a folga de 1 s cobre só o registro e a releitura
  assert.ok(ms < ttl + 1_000, `a zona nova levou ${ms} ms para responder; TTL ${ttl} ms`)
  const doc = await pedir('/zona9/pagina?x=1', { cookie: ana })
  assert.equal(doc.status, 200)
  assert.match(doc.html, /zona9\/pagina/)
  // assets e RSC da zona nova tambem roteiam (caminho rapido)
  const rsc = await fetch(`${SHELL_URL}/zona9/pagina?_rsc=abc12`, { headers: { cookie: ana, rsc: '1' }, redirect: 'manual' })
  assert.equal(rsc.status, 200)
  // o RSC vai pelo caminho rapido, nao pelo gateway: o Next tira os cabecalhos de voo do proxy.ts sem
  // `skipProxyUrlNormalize`, e a busca de RSC pareceria documento (o Next anota a reescrita na resposta)
  assert.doesNotMatch(rsc.headers.get('x-middleware-rewrite') ?? '', /_gateway/, 'RSC foi ao gateway')
  assert.match(rsc.headers.get('x-middleware-rewrite') ?? '', /_rsc=abc12/, 'o ?_rsc nao seguiu para a zona')
  assert.equal(ambiente.apps.get('erp-shell').pid, pid, 'o shell foi reiniciado')

  assert.equal(await zona9.remover('zona9'), 204)
  const fim = await ate404()
  assert.equal(fim.st, 404, 'rota removida e a zona continuou respondendo pelo shell')
  assert.ok(fim.ms < ttl + 1_000, `a zona removida levou ${fim.ms} ms para sair; TTL ${ttl} ms`)
  console.log(`# L10: zona nova roteada em ${ms} ms; removida, 404 em ${fim.ms} ms (TTL ${ttl} ms)`)
})

test('L11 (C3): origem registrada fora de ERP_ZONAS_ORIGENS_PERMITIDAS nao roteia', { timeout: 60_000 }, async () => {
  const ttl = Number(process.env.ERP_MAPA_ZONAS_TTL_MS)
  const ana = (await entrar('ana')).cookie
  zona9 ??= await subirZonaDeTeste({ id: 'zona9', porta: 3009, hosts: ['127.0.0.1', '127.0.0.2'] })
  // 127.0.0.2 é loopback de verdade (a zona de teste ouve lá), mas fora de `127.0.0.1:*,localhost:*`
  const direto = await fetch('http://127.0.0.2:3009/zona8', { redirect: 'manual' })
  assert.equal(direto.status, 200, 'dentes: a origem fora da lista responde quando chamada direto')
  assert.equal(await zona9.registrar('zona8', 'http://127.0.0.2:3009'), 200)
  try {
    await new Promise((ok) => setTimeout(ok, 2 * ttl + 500))
    const antes = zona9.recebidas.length
    for (let i = 0; i < 3; i++) {
      const r = await pedir('/zona8', { cookie: ana })
      assert.equal(r.status, 404, `origem fora da lista roteou (status ${r.status})`)
      assert.doesNotMatch(r.html, /zona de teste/)
      await new Promise((ok) => setTimeout(ok, ttl / 2))
    }
    assert.equal(zona9.recebidas.slice(antes).filter((x) => x.caminho.startsWith('/zona8')).length, 0, 'o shell chamou a origem fora da lista')
  } finally {
    await zona9.remover('zona8')
  }
})

test('C3: /_gateway direto do navegador da 404, com e sem cookie, em qualquer grafia', async () => {
  const ana = (await entrar('ana')).cookie
  for (const c of ['/_gateway/zona1', '/_gateway/zona1/relatorios', '/%5Fgateway/zona1', '/_GATEWAY/zona1', '/_gateway']) {
    for (const cookie of [ana, undefined]) {
      const r = await pedir(c, { cookie })
      assert.equal(r.status, 404, `${c} cookie=${!!cookie}`)
      assert.doesNotMatch(r.html, /Painel|zona1/i, `${c}: conteudo de zona pelo gateway`)
    }
  }
  // dentes: o mesmo documento pelo caminho de verdade chega
  assert.equal((await pedir('/zona1', { cookie: ana })).status, 200)
})

test('C3: /_next/data do shell para o caminho do gateway da 404 (a pagina interna nao e alcancavel por ai)', async () => {
  const ana = (await entrar('ana')).cookie
  const buildId = readFileSync(join(RAIZ, 'erp-shell', '.next', 'BUILD_ID'), 'utf8').trim()
  // com cookie (sem ele o proxy manda ao login, como em qualquer rota protegida)
  const r = await pedir(`/_next/data/${buildId}/_gateway/zona1.json`, { cookie: ana })
  assert.equal(r.status, 404, `/_next/data/.../_gateway/zona1.json: ${r.status}`)
  assert.doesNotMatch(r.html, /Painel|zona1/i, 'conteudo de zona pelo /_next/data')
})

test('C3: documento pelo gateway chega comprimido como a zona mandou, sem o caminho interno nos cabecalhos', async () => {
  const ana = (await entrar('ana')).cookie
  const { request } = await import('node:http')
  const { gunzipSync } = await import('node:zlib')
  const cru = await new Promise((ok, falha) => {
    const r = request(`${SHELL_URL}/zona1`, { headers: { cookie: ana, 'accept-encoding': 'gzip' } }, (res) => {
      const partes = []
      res.on('data', (p) => partes.push(p))
      res.on('end', () => ok({ status: res.statusCode, headers: res.headers, corpo: Buffer.concat(partes) }))
    })
    r.on('error', falha)
    r.end()
  })
  assert.equal(cru.status, 200)
  assert.equal(cru.headers['content-encoding'], 'gzip')
  const html = gunzipSync(cru.corpo).toString()
  assert.match(html, /<html/)
  assert.ok(cru.corpo.length < html.length / 2, `corpo de ${cru.corpo.length} bytes para ${html.length} de HTML: nao veio comprimido`)
  // o Next anota toda reescrita do proxy.ts na resposta (`x-middleware-rewrite`, `x-nextjs-rewritten-path`): aqui
  // so o caminho relativo `/_gateway/...`, que do navegador da 404; nenhum cabecalho traz a origem interna da zona
  for (const [k, v] of Object.entries(cru.headers)) {
    assert.doesNotMatch(`${k}: ${v}`, /127\.0\.0\.1:300|localhost:300[1-9]/, 'cabecalho com origem interna')
    if (!['x-middleware-rewrite', 'x-nextjs-rewritten-path'].includes(k)) assert.doesNotMatch(`${k}: ${v}`, /_gateway/, 'cabecalho com caminho interno')
  }
})

test('C3 (item da revisao da Task 3): shell de producao sem ERP_ZONAS_ORIGENS_PERMITIDAS ou ERP_TOKEN_SERVICO nao sobe', { timeout: 60_000 }, async () => {
  for (const falta of ['ERP_ZONAS_ORIGENS_PERMITIDAS', 'ERP_TOKEN_SERVICO']) {
    const env = { ...ambienteDoPapel('shell', process.env), SESSAO_DIR: ambiente.sessaoDir, ERP_PERMITIR_IDENTIDADE_DEV: '1' }
    delete env[falta]
    // o `next` direto, sem o `pnpm` no meio: no estouro o SIGKILL tem de pegar o servidor, senao ele fica orfao na porta
    // segurando o pipe e a verificacao inteira nao termina
    const p = spawn(process.execPath, [join(RAIZ, 'erp-shell', 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', '3011'], {
      cwd: join(RAIZ, 'erp-shell'), env: { ...env, NODE_ENV: 'production' }, stdio: ['ignore', 'ignore', 'pipe'],
    })
    let erro = ''
    p.stderr.on('data', (d) => { erro += d })
    const codigo = await new Promise((ok) => {
      const t = setTimeout(() => { p.kill('SIGKILL'); ok('nao saiu em 30 s') }, 30_000)
      p.once('exit', (c) => { clearTimeout(t); ok(c) })
    })
    assert.equal(codigo, 1, `sem ${falta}: ${codigo}`)
    assert.match(erro, new RegExp(falta), `sem ${falta}: o erro nao diz o que falta`)
  }
})

// C1 (ADR-0011): a zona 1 embute um bloco da zona 2. O fragmento é servidor→servidor, direto na origem interna da zona.
const ZONA2_DIRETO = `http://127.0.0.1:${APPS.find((a) => a.dir === 'erp-zona-2').porta}`
const FRAGMENTO_TAREFAS = '/zona2/_fragmento/tarefas/pendentes'
const BLOCO_TAREFAS = /data-fragmento="zona2\/tarefas"/
// semente do dominio C: t-3 pendente com titulo hostil, t-4 concluida (auditor_c1_1, E-Z4 e E-Z6)
const T3_ESCAPADO = 'Conferir &quot;lote&quot; &lt;A&amp;B&gt;'
const tarefasDoBloco = (html, quem) => {
  // dentro de <li>: a lista inteira escapada como texto (auditor_c1_2, V-Z4e) tambem traz o titulo escapado
  assert.ok(html.includes(`<li>${T3_ESCAPADO}</li>`), `${quem}: pendente t-3 ausente, sem escape ou fora de <li>`)
  assert.ok(!html.includes('<A&B>'), `${quem}: titulo da tarefa chegou cru, sem escape`)
  assert.doesNotMatch(html, /Arquivar relatório antigo/, `${quem}: tarefa concluida no bloco de pendentes`)
}
// Invariante 8 pela estrutura, nao pelo texto (auditor_c1_2: V-U1c, V-U1d, V-U1f): a sequencia de elementos de
// primeiro nivel do <main> do painel, com texto solto no nivel 0 tambem contado. Qualquer coisa no lugar do bloco
// ausente (paragrafo, secao vazia, texto) muda a sequencia. Bloco novo legitimo no painel muda a lista esperada aqui.
const VAZIOS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const elementosDoPainel = (html) => {
  const ini = html.indexOf('>', html.indexOf('<main')) + 1
  const corpo = html.slice(ini, html.indexOf('</main>', ini)).replace(/<!--[\s\S]*?-->/g, '')
  const seq = []
  let nivel = 0, fim = 0
  for (const m of corpo.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    if (nivel === 0 && corpo.slice(fim, m.index).trim()) seq.push(`texto:${corpo.slice(fim, m.index).trim()}`)
    fim = m.index + m[0].length
    const [, fecha, tag, attrs] = m
    if (fecha) { nivel--; continue }
    if (nivel === 0) {
      const rotulo = attrs.match(/aria-labelledby="([^"]*)"/)?.[1]
      const relatorios = tag === 'p' && corpo.startsWith('<a href="/zona1/relatorios">Relatórios</a></p>', fim)
      seq.push(relatorios ? 'p:relatorios' : rotulo ? `${tag}:${rotulo}` : tag)
    }
    if (!VAZIOS.has(tag.toLowerCase()) && !attrs.trim().endsWith('/')) nivel++
  }
  if (corpo.slice(fim).trim()) seq.push(`texto:${corpo.slice(fim).trim()}`)
  return seq
}
const pedirFragmento = (caminho, { cookie, cabecalhos = {} } = {}) => fetch(`${ZONA2_DIRETO}${caminho}`, {
  headers: { accept: 'text/html', ...(cookie ? { cookie } : {}), ...cabecalhos }, redirect: 'manual',
})

test('C1a (ADR-0011): a zona 2 serve o fragmento de tarefas so a quem tem tarefas.ver, inerte e sem cache', async () => {
  for (const u of ['ana', 'eva']) {
    const r = await pedirFragmento(FRAGMENTO_TAREFAS, { cookie: (await entrar(u)).cookie, cabecalhos: { 'accept-fragmento-versao': '1' } })
    assert.equal(r.status, 200, u)
    assert.match(r.headers.get('content-type') ?? '', /^text\/html/, u)
    assert.equal(r.headers.get('cache-control'), 'private, no-store', u)
    const html = await r.text()
    assert.match(html, BLOCO_TAREFAS, u)
    assert.match(html, /Tarefas pendentes \(zona 2\)/, u)
    assert.doesNotMatch(html, /<script|<html|<body|\son[a-z]+\s*=|javascript:/i, `fragmento ativo ou documento inteiro para ${u}`)
    tarefasDoBloco(html, u)
  }
  // sem o modulo da zona 2: ausencia, sem corpo (invariante 8; ADR-0011, decisao 6)
  for (const u of ['bruno', 'davi']) {
    const r = await pedirFragmento(FRAGMENTO_TAREFAS, { cookie: (await entrar(u)).cookie })
    assert.equal(r.status, 204, u)
    assert.equal(await r.text(), '', u)
  }
  const ana = (await entrar('ana')).cookie
  // sem cookie, a camada 1 da zona manda ao login (o consumidor trata como ausencia); cookie forjado morre na camada 2
  assert.equal((await pedirFragmento(FRAGMENTO_TAREFAS)).status, 307)
  assert.equal((await pedirFragmento(FRAGMENTO_TAREFAS, { cookie: '__Host-session=forjado' })).status, 204)
  // so a chave `pendentes` existe; outra versao do contrato e ausencia
  assert.equal((await pedirFragmento('/zona2/_fragmento/tarefas/todas', { cookie: ana })).status, 204)
  assert.equal((await pedirFragmento(FRAGMENTO_TAREFAS, { cookie: ana, cabecalhos: { 'accept-fragmento-versao': '2' } })).status, 204)
  // navegacao de documento ou iframe nao e composicao (ADR-0011, decisao 8)
  for (const destino of ['document', 'iframe']) {
    assert.equal((await pedirFragmento(FRAGMENTO_TAREFAS, { cookie: ana, cabecalhos: { 'sec-fetch-dest': destino } })).status, 404, destino)
  }
})

test('C1b (ADR-0011, decisao 8): o navegador nao alcanca _fragmento pelo shell, em nenhuma grafia, com ou sem cookie', async () => {
  const ana = (await entrar('ana')).cookie
  const caminhos = [FRAGMENTO_TAREFAS, '/ZONA2/_Fragmento/tarefas/pendentes', '/zona2/%5Ffragmento/tarefas/pendentes', '/zona1/_fragmento/x/y']
  for (const caminho of caminhos) {
    for (const cookie of [ana, undefined]) {
      const r = await fetch(`${SHELL_URL}${caminho}`, { headers: cookie ? { cookie } : {}, redirect: 'manual' })
      assert.equal(r.status, 404, `${caminho} ${cookie ? 'com' : 'sem'} cookie`)
      assert.equal(await r.text(), '', `${caminho}: 404 com corpo`)
      assert.equal(r.headers.get('cache-control'), 'no-store', caminho)
    }
  }
  // dente: a mesma ana pelo shell chega a zona 2
  assert.equal((await pedir('/zona2', { cookie: ana })).status, 200)
})

test('C1c: o painel da zona 1 mostra o bloco de tarefas da zona 2 so para quem tem os dois modulos', async () => {
  const r = await pedir('/zona1', { cookie: (await entrar('ana')).cookie })
  assert.equal(r.status, 200)
  assert.match(r.html, BLOCO_TAREFAS, 'ana (zona 1 e zona 2) nao viu o bloco')
  assert.match(r.html, /Tarefas pendentes \(zona 2\)/)
  tarefasDoBloco(r.html, 'ana no painel')
  for (const u of ['bruno', 'davi']) {
    const s = await pedir('/zona1', { cookie: (await entrar(u)).cookie })
    assert.equal(s.status, 200, u)
    assert.doesNotMatch(s.html, BLOCO_TAREFAS, `${u} (so zona 1) viu o bloco`)
    assert.doesNotMatch(s.html, /Tarefas pendentes/, `${u}: titulo do bloco sem o bloco`)
    assert.ok(!/sem acesso|não autorizado|acesso negado/i.test(s.html), `placeholder de sem acesso para ${u} (invariante 8)`)
    // nada no lugar do bloco, com qualquer texto: so os blocos da zona 1 (o link de relatorios depende do usuario)
    assert.deepEqual(elementosDoPainel(s.html).filter((e) => e !== 'p:relatorios'),
      ['h1', 'section:indicadores', 'section:recursos', 'button'], `${u}: elemento no lugar do bloco da zona 2 (invariante 8)`)
    // nenhum rastro do bloco, nem placeholder de indisponivel (invariante 8; E-U1b)
    assert.doesNotMatch(s.html, /tarefa|zona 2/i, `${u}: rastro do bloco da zona 2 sem o modulo`)
  }
})

test('C1d: zona 2 travada ou fora apaga so o bloco dela no painel da zona 1, dentro do timeout do fragmento', { timeout: 90_000 }, async () => {
  const ana = (await entrar('ana')).cookie
  const limite = (Number(process.env.ERP_FRAGMENTO_TIMEOUT_MS) || 2_000) + 2_000
  const semBloco = (r, quando) => {
    assert.equal(r.status, 200, quando)
    assert.match(r.html, /Painel da zona 1/, quando)
    assert.doesNotMatch(r.html, BLOCO_TAREFAS, quando)
  }
  ambiente.congelarApp('erp-zona-2')
  try {
    const t0 = Date.now()
    const r = await pedir('/zona1', { cookie: ana })
    const ms = Date.now() - t0
    semBloco(r, 'zona 2 travada')
    assert.ok(ms < limite, `painel levou ${ms} ms com a zona 2 travada (limite ${limite} ms)`)
  } finally { ambiente.descongelarApp('erp-zona-2') }
  await ambiente.derrubarApp('erp-zona-2')
  try {
    semBloco(await pedir('/zona1', { cookie: ana }), 'zona 2 fora')
  } finally { await ambiente.subirApp('erp-zona-2') }
  // o bloco volta sozinho quando a zona 2 volta
  const t0 = Date.now()
  let html = ''
  while (Date.now() - t0 < 10_000 && !BLOCO_TAREFAS.test(html)) {
    html = (await pedir('/zona1', { cookie: ana })).html
    if (!BLOCO_TAREFAS.test(html)) await new Promise((r) => setTimeout(r, 200))
  }
  assert.match(html, BLOCO_TAREFAS, 'o bloco nao voltou em 10 s depois de a zona 2 voltar')
})

test('L8 (auditor_shell_3/4): o nonce da CSP e novo e imprevisivel a cada requisicao, no shell, na rota publica e nas zonas', async () => {
  // as zonas tem nonce proprio (criarProxy do nucleo): so o shell nao pegava nonce fixo nelas
  const { cookie } = await entrar('ana')
  for (const c of ['/', '/login', '/zona1', '/zona2']) {
    const ns = []
    for (let i = 0; i < 4; i++) ns.push((await pedir(c, { cookie: c === '/login' ? undefined : cookie })).csp?.match(/'nonce-([^']+)'/)?.[1])
    assert.ok(ns.every(Boolean), `${c} sem nonce`)
    assert.equal(new Set(ns).size, ns.length, `${c}: nonce repetido entre requisicoes`)
    for (let i = 1; i < ns.length; i++) {
      let p = 0
      while (p < ns[i].length && ns[i][p] === ns[i - 1][p]) p++
      // contador ou relogio deixam prefixo comum longo entre pedidos seguidos
      assert.ok(p < 8, `${c}: nonces seguidos com ${p} caracteres de prefixo comum (${ns[i - 1]} / ${ns[i]})`)
    }
  }
})

test('L5 (reviewer_shell_2): o shell apaga o cookie de flash com Secure, senao o navegador ignora e o toast repete', async () => {
  const ana = (await entrar('ana')).cookie
  const flash = encodeURIComponent(JSON.stringify({ tipo: 'sucesso', texto: 'Uma vez so', id: 'f1' }))
  for (const caminho of ['/', '/zona1']) {
    const r = await fetch(`${SHELL_URL}${caminho}`, { headers: { cookie: `${ana}; __Host-flash=${flash}` }, redirect: 'manual' })
    const apaga = r.headers.getSetCookie().find((c) => c.startsWith('__Host-flash='))
    assert.ok(apaga, `${caminho} nao apagou o cookie de flash`)
    assert.match(apaga, /Max-Age=0/i, caminho)
    assert.match(apaga, /;\s*Secure/i, `${caminho}: remocao de __Host- sem Secure e ignorada pelo navegador`)
    assert.match(apaga, /Path=\//i, caminho)
  }
})

test('L6: navegacao do cliente (RSC) com a gestao de acesso fora nao traz o modulo restrito', {
  skip: acharChrome() ? false : COMO_CONSEGUIR_UM_NAVEGADOR,
}, async () => {
  // HTTP puro não reproduz a navegação do cliente: o Next pede só o segmento da página, com a
  // árvore do roteador, e o layout que mostra "indisponível" pode não rodar de novo. Só um
  // navegador de verdade faz esse pedido (lacuna registrada pelo challenger_shell_2).
  const { id } = await entrar('bruno')
  const { pagina, fechar } = await abrirNavegador()
  try {
    await pagina.cookie('__Host-session', id, SHELL_URL)
    await pagina.ir(`${SHELL_URL}/zona1`)
    assert.match(await pagina.avaliar('document.body.innerText'), /Painel da zona 1/, 'a zona 1 nao abriu com a gestao de acesso no ar')
    await ambiente.derrubarDominio('gestao-acesso-v2')
    try {
      pagina.respostas.length = 0
      pagina.pedidos.length = 0
      await pagina.avaliar("window.next.router.push('/zona1/relatorios')")
      await pagina.esperarRede()
      // A guarda olha o PEDIDO, não a resposta: com o fail-closed o Next pode abortar a resposta
      // RSC e cair para navegação completa. O que importa é que a navegação do cliente foi tentada.
      const rsc = pagina.pedidos.filter((p) => /[?&]_rsc=/.test(p.url) || Object.keys(p.headers).some((k) => k.toLowerCase() === 'rsc'))
      assert.ok(rsc.length > 0, `nenhuma requisicao RSC aconteceu (o teste nao provaria nada): ${pagina.pedidos.map((p) => p.url).join(', ')}`)
      for (const r of pagina.respostas) {
        assert.ok(!/recursos no seu escopo|com custo|Relatórios/.test(r.corpo ?? ''), `modulo restrito no corpo de ${r.url}`)
      }
      assert.ok(!/recursos no seu escopo|com custo/.test(await pagina.avaliar('document.body.innerText')), 'modulo restrito na tela')
    } finally { await ambiente.subirDominio('gestao-acesso-v2') }
  } finally { await fechar() }
})

test('G2: CSP completa no shell, inclusive nas rotas publicas', async () => {
  const { cookie } = await entrar('ana')
  for (const [c, ck] of [['/', cookie], ['/login', undefined]]) {
    const csp = (await pedir(c, { cookie: ck })).csp ?? ''
    for (const d of ["form-action 'self'", "img-src 'self' data:", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"]) {
      assert.ok(csp.includes(d), `${c}: CSP sem ${d}`)
    }
    assert.match(csp, /'nonce-[^']+'/, `${c}: CSP sem nonce`)
  }
})

test('G5: zona fora: o asset estatico dela tambem da 503 (a sonda vem antes do corte de asset)', async () => {
  await ambiente.derrubarApp('erp-zona-2')
  try {
    await new Promise((r) => setTimeout(r, 1200))
    for (const c of ['/zona2-static/_next/static/x.js', '/ZONA2-STATIC/a.css']) {
      const r = await fetch(`${SHELL_URL}${c}`, { redirect: 'manual' })
      assert.equal(r.status, 503, c)
      assert.equal(r.headers.get('retry-after'), '5', c)
    }
  } finally { await ambiente.subirApp('erp-zona-2') }
})

test('T1 (nucleo 8): o trace do navegador chega ao dominio, sem dado pessoal', async () => {
  // troca o dominio A por um que so registra o traceparent recebido
  const recebidos = []
  await ambiente.derrubarDominio('dominio-a')
  const falso = createServer((req, res) => {
    recebidos.push(req.headers.traceparent ?? '')
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('[]')
  })
  await new Promise((ok) => falso.listen(4001, '127.0.0.1', ok))
  try {
    const trace = '4bf92f3577b34da6a3ce929d0e0e4736'
    const { cookie } = await entrar('davi')
    await pedir('/zona1', { cookie, cabecalhos: { traceparent: `00-${trace}-00f067aa0ba902b7-01` } })
    assert.ok(recebidos.length > 0, 'o dominio A nao foi chamado')
    for (const t of recebidos) {
      assert.match(t, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/, `traceparent invalido: ${t}`)
      assert.equal(t.split('-')[1], trace, 'o dominio recebeu outro trace: a cadeia quebrou no BFF')
      assert.notEqual(t.split('-')[2], '00f067aa0ba902b7', 'o BFF repassou o span do navegador em vez de abrir um filho')
    }
    // sem traceparent do navegador, o proxy abre um trace e o dominio recebe um valido
    recebidos.length = 0
    await pedir('/zona1', { cookie })
    assert.match(recebidos[0] ?? '', /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
  } finally {
    await new Promise((ok) => falso.close(ok))
    await ambiente.subirDominio('dominio-a')
  }
})

// ---------------------------------------------------------------------------------------------
// Gestão de acesso v2 (ADR-0014, adendo 1): uma autoridade só, e fechada.

test('v2 fora e v1 no ar: as apps nao voltam a v1; servico indisponivel, nunca conteudo', async () => {
  const ana = (await entrar('ana')).cookie
  const davi = (await entrar('davi')).cookie
  await ambiente.derrubarDominio('gestao-acesso-v2')
  await ambiente.subirDominio('gestao-acesso')   // a v1 concederia o painel e a zona 2
  try {
    for (const [cookie, caminho, conteudo] of [[ana, '/zona2', CONTEUDO_DE_MODULO['/zona2']], [davi, '/zona1', CONTEUDO_DE_MODULO['/zona1']]]) {
      const r = await pedir(caminho, { cookie })
      assert.match(r.html, /<h1>Serviço indisponível<\/h1>/, caminho)
      assert.ok(!conteudo.test(r.html), `${caminho}: conteudo veio da v1`)
    }
  } finally {
    await ambiente.derrubarDominio('gestao-acesso')
    await ambiente.subirDominio('gestao-acesso-v2')
  }
  assert.equal((await pedir('/zona2', { cookie: ana })).status, 200)
})

test('pessoa desligada na gestao de acesso vai ao login na requisicao seguinte, nunca ao conteudo', async () => {
  const davi = (await entrar('davi')).cookie
  assert.equal((await pedir('/zona1', { cookie: davi })).status, 200)
  // o desligamento acontece no domínio (quem administra, pela API dele); o BFF só observa
  const r = await fetch('http://127.0.0.1:4020/v2/pessoas/p-20/desligamento', { method: 'POST', headers: { authorization: 'Bearer dev.carla' } })
  assert.equal(r.status, 204)
  try {
    for (const caminho of ['/zona1', '/']) {
      const p = await pedir(caminho, { cookie: davi })
      assert.ok(!CONTEUDO_DE_MODULO['/zona1'].test(p.html) && !p.html.includes('Olá,'), `${caminho}: conteudo para pessoa desligada`)
      assert.match(p.local ?? p.html, /\/login/, `${caminho}: nao foi ao login`)
    }
  } finally {
    // o domínio falso guarda tudo em memória: reiniciar volta à semente
    await ambiente.derrubarDominio('gestao-acesso-v2')
    await ambiente.subirDominio('gestao-acesso-v2')
  }
})

// ---------------------------------------------------------------------------------------------
// Slice K3 (auditor_b1_d1_4: V1-V5, L1-L5)

test('V1 (E01f): REDIS_URL de escrita do shell nao esta presente no ambiente das zonas', () => {
  for (const dir of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const proc = ambiente.apps.get(dir)
    assert.ok(proc?.pid, `${dir}: processo nao encontrado`)
    const environ = readFileSync(`/proc/${proc.pid}/environ`, 'utf8')
    assert.ok(!environ.includes('REDIS_URL='), `${dir}: processo contem REDIS_URL de escrita em /proc/<pid>/environ`)
  }
  // dentes: no modo Redis o shell tem a variável, então a leitura de /proc acima enxerga o que procura
  if (!process.env.REDIS_URL) return
  const procShell = ambiente.apps.get('erp-shell')
  assert.ok(procShell?.pid, 'erp-shell: processo nao encontrado')
  const environShell = readFileSync(`/proc/${procShell.pid}/environ`, 'utf8')
  assert.ok(environShell.includes('REDIS_URL='), 'erp-shell: processo deve conter REDIS_URL')
})

test('V1 (auditor_b1_d1_8): nenhum processo de zona ou dominio recebe a senha de escrita, em nenhuma fase', () => {
  const senhas = [process.env.ERP_REDIS_SENHA_SHELL, process.env.REDIS_URL && decodeURIComponent(new URL(process.env.REDIS_URL).password)].filter(Boolean)
  assert.ok(senhas.length >= 1, 'sem senha para procurar')
  const entregues = ambiente.ambientesEntregues.filter((e) => e.dir !== 'erp-shell')
  // start de toda zona e domínio e registrar das zonas-módulo; build, se houve, também está aqui
  for (const dir of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso', 'erp-dominio-stub']) {
    assert.ok(entregues.some((e) => e.dir === dir && e.fase === 'start'), `${dir}: start nao registrado`)
  }
  for (const dir of ['erp-zona-1', 'erp-zona-2']) assert.ok(entregues.some((e) => e.dir === dir && e.fase === 'registrar'), `${dir}: registrar nao registrado`)
  for (const { fase, dir, ambiente: env, extras } of entregues) {
    const vazou = Object.entries(env).filter(([k, v]) => !extras.includes(k) && senhas.some((s) => String(v).includes(s)))
    assert.deepEqual(vazou.map(([k]) => k), [], `${dir} (${fase}) recebeu a senha de escrita`)
    assert.ok(!('REDIS_URL' in env) || extras.includes('REDIS_URL'), `${dir} (${fase}) recebeu REDIS_URL`)
  }
  // no ar, pelo que o sistema operacional diz de cada processo (não só pelo registro)
  // só os vivos: testes anteriores derrubam domínios de propósito (a gestão de acesso v1 sobe e desce)
  const vivos = [...ambiente.apps, ...ambiente.dominios].filter(([n, p]) => n !== 'erp-shell' && p.exitCode === null && p.signalCode === null)
  for (const z of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) assert.ok(vivos.some(([n]) => n === z), `${z} nao esta no ar`)
  for (const [nome, proc] of vivos) {
    const environ = readFileSync(`/proc/${proc.pid}/environ`, 'utf8')
    assert.ok(!senhas.some((s) => environ.includes(s)), `${nome}: a senha de escrita esta no ambiente do processo`)
  }
  // dentes: o shell recebe a senha, então a leitura de /proc enxerga o que procura
  const shell = readFileSync(`/proc/${ambiente.apps.get('erp-shell').pid}/environ`, 'utf8')
  assert.ok(shell.includes(process.env.ERP_REDIS_SENHA_SHELL), 'o shell deveria receber a senha de escrita')
})

test('V3 (E10d): centro de custo nao vaza no HTML nem no RSC da listagem /zona1 para o bruno', async () => {
  const bruno = (await entrar('bruno')).cookie
  const html = (await pedir('/zona1', { cookie: bruno })).html
  const rsc = (await pedir('/zona1', { cookie: bruno, cabecalhos: { rsc: '1' } })).html
  for (const [nome, corpo] of [['HTML', html], ['RSC', rsc]]) {
    assert.ok(!/CC-10|CC-20|CC-99/.test(corpo), `centro de custo vazou no ${nome} de /zona1`)
    assert.ok(!/"custo"|\\"custo\\"/.test(corpo), `campo de custo vazou no ${nome} de /zona1`)
  }
})

test('V5 (XN01p): bundles estaticos do cliente (.next/static) nao vazam portas de dominio nem redis', () => {
  const varrerArquivos = (dir) => {
    let encontrados = []
    for (const item of readdirSync(dir)) {
      const p = join(dir, item)
      if (statSync(p).isDirectory()) encontrados.push(...varrerArquivos(p))
      else if (item.endsWith('.js')) encontrados.push(p)
    }
    return encontrados
  }
  for (const app of ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const dirEstatico = join(RAIZ, app, '.next', 'static')
    const arquivos = varrerArquivos(dirEstatico)
    assert.ok(arquivos.length > 0, `${app}: nenhum arquivo .js encontrado em .next/static`)
    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, 'utf8')
      assert.ok(!/127\.0\.0\.1:40\d\d/.test(conteudo), `${arquivo} contem endereco interno de dominio 127.0.0.1:40xx`)
      assert.ok(!/redis:\/\//.test(conteudo), `${arquivo} contem URL do Redis redis://`)
    }
  }
})

test('L2 (P16b): mutacao envia a versao real do recurso (versao 1 em t-2), provando que If-Match nao e fixo em 3', async () => {
  const ana = (await entrar('ana')).cookie
  const campos = formularios((await pedir('/zona2', { cookie: ana })).html).find((c) => c.id === 't-2')
  assert.ok(campos, 'formulario da tarefa t-2')
  assert.equal(campos.versao, '1', 'a tarefa t-2 deve vir com versao 1 da semente')
  const r = await acaoPeloCliente({ ...CONCLUIR, campos, cookie: ana })
  assert.equal(r.status, 200)
  assert.match(r.corpo, /"destino":"\/zona1"/, 'a action concluiu com sucesso usando If-Match: 1')
  // restaura dominio-c para nao alterar o estado das outras assercoes
  await ambiente.derrubarDominio('dominio-c')
  await ambiente.subirDominio('dominio-c')
})

// --- D2, Task 5: um modo de identificação por processo nos domínios (ADR-0013, decisão 7) ------------
const b64u = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
const comToken = (token) => ({ headers: { authorization: `Bearer ${token}` } })

test('D2: dominio sem IDP_EMISSOR (a base) recusa todo JWT, mesmo bem assinado; o token dev do mesmo ator passa', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const agora = Math.floor(Date.now() / 1000)
  const p = b64u({ iss: KEYCLOAK_EMISSOR, aud: 'erp-dominios', exp: agora + 300, preferred_username: 'bruno' })
  const rs = b64u({ alg: 'RS256', typ: 'JWT', kid: 'k1' })
  const hs = b64u({ alg: 'HS256', typ: 'JWT', kid: 'k1' })
  const tokens = {
    RS256: `${rs}.${p}.${sign('sha256', Buffer.from(`${rs}.${p}`), privateKey).toString('base64url')}`,
    'alg none': `${b64u({ alg: 'none' })}.${p}.`,
    'HS256 com a chave publica': `${hs}.${p}.${createHmac('sha256', publicKey.export({ type: 'spki', format: 'pem' })).update(`${hs}.${p}`).digest('base64url')}`,
  }
  for (const [caso, token] of Object.entries(tokens)) {
    const r = await fetch('http://127.0.0.1:4001/v1/recursos/r-1', comToken(token))
    assert.equal(r.status, 401, caso)
    assert.deepEqual(await r.json(), { codigo: 'SESSAO_EXPIRADA' }, caso)
  }
  assert.equal((await fetch('http://127.0.0.1:4001/v1/recursos/r-1', comToken('dev.bruno.00000000-0000-4000-8000-000000000000'))).status, 200, 'dentes: o token dev passa')
})

test('D2: dominio com IDP_EMISSOR (pela lista de inclusao) aceita o access token do Keycloak, com o ator certo, e recusa o token dev', {
  skip: !(await keycloakNoAr()) && 'Keycloak do showcase fora do ar (task showcase:subir)', timeout: 60_000,
}, async () => {
  // um domínio A avulso, noutra porta, com o ambiente que a base daria a um domínio com IDP_EMISSOR
  const PORTA = 4101
  const env = ambienteDoPapel('dominio', { ...process.env, IDP_EMISSOR: KEYCLOAK_EMISSOR })
  assert.equal(env.IDP_EMISSOR, KEYCLOAK_EMISSOR, 'IDP_EMISSOR fora da lista de inclusao do dominio')
  const codigo = `import { criarDominioA } from './src/dominio-a.mjs'
    import { verificadorDoProcesso } from './src/base.mjs'
    verificadorDoProcesso()
    criarDominioA().listen(${PORTA}, '127.0.0.1', () => console.log('pronto'))`
  const p = spawn('node', ['--input-type=module', '-e', codigo], { cwd: join(RAIZ, 'erp-dominio-stub'), env, stdio: ['ignore', 'pipe', 'inherit'] })
  try {
    await new Promise((ok, falha) => { p.stdout.once('data', ok); p.once('exit', (c) => falha(new Error(`dominio avulso saiu com ${c}`))) })
    const a = `http://127.0.0.1:${PORTA}/v1/recursos/r-1`
    const bruno = await tokenDoKeycloak('bruno')
    const r = await fetch(a, comToken(bruno))
    assert.equal(r.status, 200)
    assert.equal(typeof (await r.json()).custo?.valor, 'number', 'o ator nao e o preferred_username (bruno e do financeiro)')
    const ana = await (await fetch(a, comToken(await tokenDoKeycloak('ana')))).json()
    assert.ok(!('custo' in ana), 'ana recebeu custo')
    const dev = await fetch(a, comToken('dev.bruno.00000000-0000-4000-8000-000000000000'))
    assert.equal(dev.status, 401, 'token dev aceito com IDP_EMISSOR')
    assert.deepEqual(await dev.json(), { codigo: 'SESSAO_EXPIRADA' })
    const [h, , s] = bruno.split('.')
    const adulterado = `${h}.${b64u({ ...JSON.parse(Buffer.from(bruno.split('.')[1], 'base64url')), aud: 'account' })}.${s}`
    assert.equal((await fetch(a, comToken(adulterado))).status, 401, 'token adulterado aceito')
    // o domínio da base (sem IDP_EMISSOR) recusa o mesmo token do Keycloak
    assert.equal((await fetch('http://127.0.0.1:4001/v1/recursos/r-1', comToken(bruno))).status, 401, 'dominio em modo dev aceitou JWT')
  } finally {
    p.kill('SIGTERM')
  }
})

test('D2 (ADR-0013, adendo 1): com IDP_EMISSOR, o registrar-manifesto das zonas segue funcionando e o token de servico so registra o proprio modulo', { timeout: 60_000 }, async () => {
  // gestão de acesso v2 avulsa em modo JWT; o IdP nem precisa estar no ar: o token de serviço não passa por ele
  const PORTA = 4120
  const env = ambienteDoPapel('dominio', { ...process.env, IDP_EMISSOR: 'http://127.0.0.1:1/realms/erp' })
  const codigo = `import { criarGestaoDeAcessoV2 } from './src/gestao-acesso-v2/servidor.mjs'
    import { verificadorDoProcesso } from './src/base.mjs'
    if (!verificadorDoProcesso()) process.exit(2)
    criarGestaoDeAcessoV2().listen(${PORTA}, '127.0.0.1', () => console.log('pronto'))`
  const p = spawn('node', ['--input-type=module', '-e', codigo], { cwd: join(RAIZ, 'erp-dominio-stub'), env, stdio: ['ignore', 'pipe', 'inherit'] })
  const registrar = (zona, extra = {}) => new Promise((ok) => {
    const r = spawn('pnpm', ['registrar'], {
      cwd: join(RAIZ, zona), stdio: 'ignore',
      env: { ...ambienteDoPapel('zona', process.env), ACESSO_URL: `http://127.0.0.1:${PORTA}`, ...extra },
    })
    r.once('exit', ok)
  })
  try {
    await new Promise((ok, falha) => { p.stdout.once('data', ok); p.once('exit', (c) => falha(new Error(`gestao de acesso avulsa saiu com ${c}`))) })
    assert.equal(await registrar('erp-zona-1'), 0, 'zona 1 nao registrou o proprio manifesto em modo JWT')
    assert.equal(await registrar('erp-zona-2'), 0, 'zona 2 nao registrou o proprio manifesto em modo JWT')
    assert.notEqual(await registrar('erp-zona-1', { ERP_TOKEN_SERVICO: 'svc.zona2' }), 0, 'svc.zona2 registrou o manifesto da zona 1')
    const v2 = `http://127.0.0.1:${PORTA}`
    const servico = (svc, caminho, corpo) => fetch(`${v2}${caminho}`, {
      method: corpo ? 'POST' : 'GET', headers: { authorization: `Bearer ${svc}`, 'content-type': 'application/json' }, body: corpo && JSON.stringify(corpo),
    })
    assert.equal((await servico('svc.idp', '/v2/primeiro-acesso', { cpf: '34236671255', sub: 'forjado' })).status, 401)
    assert.equal((await servico('svc.zona1', '/v2/decisoes', { pessoa: 'p-1', modulo: 'zona1', funcionalidade: 'painel.ver' })).status, 401)
    assert.equal((await servico('svc.shell', '/v2/eventos')).status, 401)
  } finally {
    p.kill('SIGTERM')
  }
})
