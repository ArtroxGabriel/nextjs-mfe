// Verificação ponta a ponta da base genérica (ADR-0009). Tudo pelo shell, como no navegador.
//   node --test repos/verificacao/*.test.mjs
// Sobe domínios, registra manifestos, sobe shell e zonas; derruba no fim.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { subir, RAIZ } from '../scripts/ambiente.mjs'
import { pedir, entrar, menu, formularios, enviarFormulario, valorDoCookie, acaoPeloCliente } from './apoio.mjs'

let ambiente
before(async () => { ambiente = await subir({ construir: process.env.CONSTRUIR === '1' }) }, { timeout: 600_000 })
after(() => ambiente?.derrubar())

const TOKEN = /dev\.(ana|bruno|carla|davi)\.[0-9a-f-]{36}/

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
  const r = await pedir('/api/auth/entrar', { metodo: 'POST', corpo: new URLSearchParams({ usuario: 'intruso' }) })
  assert.equal(r.local, '/login')
  assert.equal(valorDoCookie(r.cookies, '__Host-session'), undefined)
})

const MENUS = {
  ana: ['/', '/zona1', '/zona2'],
  bruno: ['/', '/zona1', '/zona1/relatorios'],
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

test('N5/D6: modulo nao permitido responde 404 pela URL direta; permitido responde 200', async () => {
  const casos = [
    ['ana', '/zona1/relatorios', 404], ['ana', '/acesso', 404], ['ana', '/zona2', 200],
    ['bruno', '/zona1/relatorios', 200], ['bruno', '/zona2', 404], ['bruno', '/acesso', 404],
    ['carla', '/acesso', 200], ['carla', '/zona2', 404],
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

test('token nunca chega ao navegador, em nenhuma pagina', async () => {
  for (const u of Object.keys(MENUS)) {
    const { cookie } = await entrar(u)
    for (const caminho of ['/', '/zona1', '/zona1/relatorios', '/zona1/recursos/r-1', '/zona2', '/acesso']) {
      const { html } = await pedir(caminho, { cookie })
      assert.ok(!TOKEN.test(html) && !html.includes('accessToken'), `${u} ${caminho}`)
    }
  }
})

test('N6/N5: revogar uma concessao na zona de acesso vale na proxima navegacao, sem novo login', async () => {
  const carla = (await entrar('carla')).cookie
  const bruno = (await entrar('bruno')).cookie
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 200)

  const alternar = async (conceder) => {
    const forms = formularios((await pedir('/acesso', { cookie: carla })).html)
    const f = forms.find((c) => c.perfil === 'zona1.analista' && c.modulo === 'zona1.relatorios')
    assert.ok(f, 'formulario de concessao nao encontrado')
    assert.equal(f.conceder, String(conceder))
    const r = await enviarFormulario('/acesso', f, carla)
    assert.equal(r.status, 303, `action respondeu ${r.status}`)
    assert.equal(r.local, '/acesso')
  }

  await alternar(false)
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 404)
  assert.ok(!menu((await pedir('/', { cookie: bruno })).html).hrefs.includes('/zona1/relatorios'))
  await alternar(true)
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 200)
})

test('D8: a tela de acesso nao oferece perfil de zona para modulo de outra zona', async () => {
  const carla = (await entrar('carla')).cookie
  const forms = formularios((await pedir('/acesso', { cookie: carla })).html)
  assert.ok(!forms.some((f) => f.perfil === 'zona1.analista' && f.modulo === 'zona2.tarefas'))
  assert.ok(forms.some((f) => f.perfil === 'plataforma.usuario' && f.modulo === 'zona2.tarefas'))
})

test('Server Action e reverificada no servidor: quem nao tem o modulo nao executa', async () => {
  const carla = (await entrar('carla')).cookie
  const bruno = (await entrar('bruno')).cookie
  const f = formularios((await pedir('/acesso', { cookie: carla })).html)
    .find((c) => c.perfil === 'zona1.analista' && c.modulo === 'zona1.relatorios')
  const r = await enviarFormulario('/acesso', f, bruno)
  assert.notEqual(r.status, 303, 'a action de administracao rodou para o bruno')
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 200, 'a concessao mudou')
})

const CONCLUIR = { app: 'erp-zona-2', arquivo: 'app/zona2/acoes.ts', nome: 'concluirTarefa', caminho: '/zona2' }

test('Server Action de outra origem e recusada (CSRF)', async () => {
  const ana = (await entrar('ana')).cookie
  const campos = formularios((await pedir('/zona2', { cookie: ana })).html).find((c) => c.id === 't-2')
  const r = await acaoPeloCliente({ ...CONCLUIR, campos, cookie: ana, origem: 'http://evil.com' })
  assert.ok(!valorDoCookie(r.cookies, '__Host-flash'), 'a action rodou para outra origem')
  assert.match((await pedir('/zona2', { cookie: ana })).html, /Conferir inventário(<!-- -->)? — (<!-- -->)?pendente/)
})

test('N4: acao na zona 2 leva para a zona 1 e o toast aparece no documento seguinte, uma vez', async () => {
  const ana = (await entrar('ana')).cookie
  const campos = formularios((await pedir('/zona2', { cookie: ana })).html).find((c) => c.id === 't-1')
  assert.ok(campos, 'formulario da tarefa t-1')
  const r = await acaoPeloCliente({ ...CONCLUIR, campos, cookie: ana })
  assert.equal(r.status, 200)
  // Sem redirect() da action: o Next buscaria /zona1 dentro do processo da zona 2 (limitação de Multi-Zones).
  assert.equal(r.redirecionamento, null)
  assert.match(r.corpo, /"destino":"\/zona1"/, 'a ilha recebe o destino e troca o documento')
  const flash = valorDoCookie(r.cookies, '__Host-flash')
  assert.ok(flash, 'cookie de flash')

  const comFlash = (await pedir('/zona1', { cookie: `${ana}; __Host-flash=${flash}` })).html
  assert.equal((comFlash.match(/moldura-toast-sucesso">Tarefa concluída\.</g) ?? []).length, 1)
  const semFlash = (await pedir('/zona1', { cookie: ana })).html
  assert.ok(!semFlash.includes('Tarefa concluída'))
  assert.match((await pedir('/zona2', { cookie: ana })).html, /Revisar cadastro(<!-- -->)? — (<!-- -->)?concluída/)
})

test('Server Action na mesma zona funciona pelo caminho do navegador (redirect para a propria zona)', async () => {
  const carla = (await entrar('carla')).cookie
  const bruno = (await entrar('bruno')).cookie
  const acao = (campos) => acaoPeloCliente({ app: 'erp-zona-acesso', arquivo: 'app/acesso/acoes.ts', nome: 'alterarConcessao', caminho: '/acesso', campos, cookie: carla })
  const achar = async () => formularios((await pedir('/acesso', { cookie: carla })).html)
    .find((c) => c.perfil === 'zona1.analista' && c.modulo === 'zona1.relatorios')
  const r = await acao(await achar())
  assert.equal(r.status, 200)
  assert.equal(r.redirecionamento, '/acesso;push')
  assert.match(r.corpo, /acesso-static/, 'o payload do redirect e da propria zona de acesso')
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 404)
  await acao(await achar())
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 200)
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
      assert.ok(!/modo: 'escrita'|escrita:|identidadeDev|\.entrar\(|\.encerrar\(/.test(t), `${f} escreve sessao`)
      assert.ok(!/cookies\(\)\)\.set\(\s*'__Host-session'/.test(t), `${f} grava o cookie de sessao`)
    }
  }
})

test('N8: nenhuma zona monta URL; toda saida passa pelo registro de destinos do nucleo', () => {
  for (const zona of ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    for (const dir of ['app', 'lib']) {
      const base = join(RAIZ, zona, dir)
      const fontes = (d) => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? fontes(join(d, n)) : [join(d, n)])
      for (const f of fontes(base)) {
        assert.ok(!/\bfetch\(/.test(readFileSync(f, 'utf8')), `${f} chama fetch direto`)
      }
    }
  }
})
