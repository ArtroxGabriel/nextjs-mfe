// Autoteste do cliente de navegador (navegador.mjs), sem a base: servidor local em porta livre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { abrirNavegador, acharChrome, COMO_CONSEGUIR_UM_NAVEGADOR, IMAGEM_DOCKER } from './navegador.mjs'

const semChrome = acharChrome() ? false : COMO_CONSEGUIR_UM_NAVEGADOR

test('o navegador navega, executa JS, envia cookie __Host- e registra respostas com corpo; limpa tudo', { skip: semChrome }, async () => {
  const recebidos = []
  const srv = createServer((req, res) => {
    recebidos.push({ url: req.url, cookie: req.headers.cookie ?? '' })
    if (req.url === '/dados') { res.setHeader('content-type', 'text/plain'); return res.end('segredo-42') }
    res.setHeader('content-type', 'text/html')
    res.end('<h1>ola</h1><script>fetch("/dados")</script>')
  })
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok))
  const base = `http://localhost:${srv.address().port}`
  const { pagina, perfil, fechar } = await abrirNavegador()
  try {
    await pagina.cookie('__Host-session', 'abc', base)
    await pagina.ir(`${base}/`)
    await pagina.esperarRede()
    assert.equal(await pagina.avaliar('document.querySelector("h1").textContent'), 'ola')
    assert.ok(pagina.respostas.some((r) => r.url.endsWith('/dados') && r.corpo === 'segredo-42'), 'resposta do fetch nao registrada')
    assert.ok(recebidos.every((r) => r.cookie.includes('__Host-session=abc')), 'cookie nao enviado pelo navegador')
  } finally {
    await fechar()
    srv.close()
  }
  if (!perfil) return   // docker: o container já foi removido pelo fechar
  assert.ok(!existsSync(perfil), `perfil ${perfil} ficou para tras`)
  // pelo caminho exato do perfil (aleatório): um texto genérico casaria com o próprio shell que roda o teste
  const { execFileSync } = await import('node:child_process')
  let vivos = ''
  try { vivos = execFileSync('pgrep', ['-f', perfil], { encoding: 'utf8' }) } catch { /* nenhum */ }
  assert.equal(vivos.trim(), '', 'processo do Chrome ficou vivo depois de fechar')
})

test('deteccao: ERP_CHROME manda; docker so quando pedido, com imagem fixada por digest', () => {
  const antes = process.env.ERP_CHROME
  try {
    process.env.ERP_CHROME = '/opt/meu/chrome'
    assert.deepEqual([acharChrome().tipo, acharChrome().cmd], ['local', '/opt/meu/chrome'])
    process.env.ERP_CHROME = 'docker'
    assert.equal(acharChrome().tipo, 'docker')
    assert.match(acharChrome().imagem, /@sha256:[0-9a-f]{64}$/)
    assert.equal(IMAGEM_DOCKER.includes(':latest'), false)
  } finally { if (antes === undefined) delete process.env.ERP_CHROME; else process.env.ERP_CHROME = antes }
})

test('deteccao: sem ERP_CHROME, docker nunca e escolhido sozinho (evita baixar 100 MB de surpresa)', () => {
  const antes = process.env.ERP_CHROME
  try { delete process.env.ERP_CHROME; assert.notEqual(acharChrome()?.tipo, 'docker') }
  finally { if (antes !== undefined) process.env.ERP_CHROME = antes }
})

test('ERP_CHROME apontando para binario inexistente falha com mensagem clara e nao deixa perfil', async () => {
  const { readdirSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const antes = process.env.ERP_CHROME
  const perfisAntes = readdirSync(tmpdir()).filter((n) => n.startsWith('erp-verificacao-')).length
  try {
    process.env.ERP_CHROME = '/nao/existe/chrome'
    await assert.rejects(abrirNavegador(), /nao abriu .*ENOENT/)
    assert.equal(readdirSync(tmpdir()).filter((n) => n.startsWith('erp-verificacao-')).length, perfisAntes, 'perfil temporario ficou para tras')
  } finally { if (antes === undefined) delete process.env.ERP_CHROME; else process.env.ERP_CHROME = antes }
})
