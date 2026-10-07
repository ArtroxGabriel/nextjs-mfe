p='base/verificacao/base.test.mjs'
s=open(p).read()
a="  process.env.ERP_REDIS_SENHA_SHELL ??= 'sentinela-k5-senha-de-escrita'\n"
assert s.count(a)==1
s=s.replace(a,a+"""  // teto da zona (D7) diferente do padrão de 10 s: o L9 prova que o shell lê a variável. Maior que ERP_DESTINO_TIMEOUT_MS
  // (5 s), senão o shell recusa subir
  process.env.ERP_ZONA_TETO_MS ??= '6000'
""")
b="  assert.equal(st, 200, 'a zona 2 nao voltou em 5 s depois de descongelada')\n})\n\ntest('L8 ("
assert s.count(b)==1
l9="""
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
      if (ms >= 2_000) segurada = { status: r.status, ms }
    }
  } finally { ambiente.descongelarApp('erp-zona-2') }
  await zonaVolta()
  assert.ok(segurada, 'em 3 tentativas nenhuma requisicao chegou a zona congelada com a sonda ainda valida')
  // 500 cru do Next ate o C3 trazer a pagina dentro do teto (DEFERRED.md D7)
  assert.equal(segurada.status, 500, `status ${segurada.status} em ${segurada.ms} ms`)
  assert.ok(segurada.ms >= teto - 500, `soltou em ${segurada.ms} ms, antes do teto de ${teto} ms`)
  assert.ok(segurada.ms < teto + 2_000, `soltou em ${segurada.ms} ms; teto ${teto} ms (sem o D7 seriam ~30 s)`)
})
"""
s=s.replace(b,"  assert.equal(st, 200, 'a zona 2 nao voltou em 5 s depois de descongelada')\n})\n"+l9+"\ntest('L8 (")
open(p,'w').write(s)
