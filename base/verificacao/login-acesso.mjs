// ADR-0014, adendo 1: o mesmo contrato no retorno dev e no retorno OIDC.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { RAIZ, SHELL } from '../scripts/ambiente.mjs'
import { pedir, iniciarLogin, valorDoCookie, loginNoKeycloak, tokenDoKeycloak, redisCru, monitorarRedis } from './apoio.mjs'

async function retornarLogin(modo, usuario) {
  if (modo === 'dev') return iniciarLogin(usuario, '/acesso')
  const ini = await pedir('/api/auth/entrar?de=%2Facesso')
  const transacao = valorDoCookie(ini.cookies, '__Host-erp-login')
  assert.ok(transacao && ini.local, 'entrada sem transacao')
  const { retorno } = await loginNoKeycloak(new URL(ini.local), usuario)
  assert.equal(retorno.origin + retorno.pathname, `${SHELL}/api/auth/retorno`)
  return pedir(retorno.pathname + retorno.search, { cookie: `__Host-erp-login=${transacao}` })
}

const chavesDeSessao = async () => {
  const resp = await redisCru(process.env.REDIS_URL, [['KEYS', 'erp:sessao:*']])
  assert.doesNotMatch(resp, /^-/m, 'Redis recusou ler chaves')
  return new Set(resp.match(/erp:sessao:[0-9a-f]{64}/g) ?? [])
}

export async function verificarLoginComAcesso({ ambiente, modo, caso }) {
  const token = async (usuario) => modo === 'oidc' ? await tokenDoKeycloak(usuario) : `dev.${usuario}`
  const admin = await token('carla')
  const chamar = (caminho, corpo, credencial = admin) => fetch(`http://127.0.0.1:4020${caminho}`, {
    method: 'POST', redirect: 'manual', headers: { authorization: `Bearer ${credencial}`, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  let monitor
  let linhas
  try {
    if (caso === 'desligado') {
      assert.equal((await chamar('/v2/pessoas/p-20/desligamento', {})).status, 204)
    } else if (caso === 'suspenso') {
      assert.equal((await chamar('/v2/pessoas/p-18/atribuicoes', { papel: 'gestor-unidade', escopo: 'central' })).status, 201)
      const semente = JSON.parse(readFileSync(join(RAIZ, 'erp-dominio-stub/dados/semente/gestao-acesso-v2.json'), 'utf8'))
      const confirmadas = semente.pessoas.filter((p) => p.unidade === 'central' && p.id !== 'p-20').map((p) => p.id)
      const r = await chamar('/v2/unidades/central/confirmacoes', { confirmadas }, await token('bruno'))
      assert.equal(r.status, 200)
      assert.deepEqual((await r.json()).suspensas, ['p-20'])
    } else {
      assert.equal(caso, 'sem-modulos')
      assert.equal((await chamar('/v2/acessos/ac-08/revogacao', {})).status, 204)
    }
    const antes = process.env.REDIS_URL ? await chavesDeSessao() : new Set()
    if (process.env.REDIS_URL) monitor = await monitorarRedis(process.env.REDIS_URL)
    const r = await retornarLogin(modo, caso === 'sem-modulos' ? 'carla' : 'davi')
    if (monitor) { linhas = await monitor.parar(); monitor = undefined }
    assert.equal(r.status, 303)
    const id = valorDoCookie(r.cookies, '__Host-session')
    const depois = process.env.REDIS_URL ? await chavesDeSessao() : new Set()
    const novas = [...depois].filter((k) => !antes.has(k))
    const gravacoes = (linhas ?? []).filter((l) => /"(?:set|setex|psetex)" "erp:sessao:/i.test(l))
    if (caso === 'sem-modulos') {
      assert.ok(id, 'pessoa ativa sem modulos nao logou')
      assert.equal(r.local, '/acesso')
      if (process.env.REDIS_URL) {
        assert.deepEqual(novas, [`erp:sessao:${createHash('sha256').update(id).digest('hex')}`])
        assert.equal(gravacoes.length, 1, 'deve gravar so a sessao definitiva')
      }
      assert.equal((await pedir('/acesso', { cookie: `__Host-session=${id}` })).status, 200)
    } else {
      assert.equal(id, undefined, 'pessoa inativa recebeu cookie de sessao')
      assert.equal(r.local, '/login', '401 da gestao deve recusar o login')
      assert.deepEqual(novas, [], 'apareceu chave de sessao nova')
      assert.equal(gravacoes.length, 0, 'gravou sessao provisoria e depois apagou')
    }
  } finally {
    if (monitor) await monitor.parar()
    // Mock em memoria: reiniciar restaura pessoas, papeis e acessos sem alterar a semente.
    await ambiente.derrubarDominio('gestao-acesso-v2')
    await ambiente.subirDominio('gestao-acesso-v2')
  }
}
