import json
SH='repos/erp-shell'; Z2='repos/erp-zona-2'; Z1='repos/erp-zona-1'
ROTA="app/zona2/%5Ffragmento/tarefas/[id]/route.ts"; HT='lib/fragmento-tarefas.ts'; PG='app/zona1/page.tsx'; FR='lib/fragmentos.ts'
NE="return new NextResponse(null, { status: 404, headers: { 'cache-control': 'no-store' } })"
DIV="{tarefas && <div dangerouslySetInnerHTML={{ __html: tarefas }} />}"
m = [
 dict(id='E-S1', repo=SH, arquivo='lib/decisao-proxy.ts', nota='exigida (ponta a ponta): remover a chamada da guarda',
      antes="    if (ehFragmento(caminho)) return { acao: 'nao-encontrado' }\n", depois=''),
 dict(id='E-P1', repo=SH, arquivo='proxy.ts', nota='variante: 404 com corpo', antes=NE, depois=NE.replace('(null,', "('nao encontrado',")),
 dict(id='E-P2', repo=SH, arquivo='proxy.ts', nota='variante: 404 sem no-store', antes=NE, depois="return new NextResponse(null, { status: 404 })"),
 dict(id='E-P3', repo=SH, arquivo='proxy.ts', nota='variante: case nao-encontrado segue para a zona', antes=NE, depois="return NextResponse.next()"),
 dict(id='E-Z1', repo=Z2, arquivo=ROTA, nota='exigida: remover exigirModulo', antes="    await nucleo.acesso.exigirModulo('zona2', 'tarefas.ver')\n", depois=''),
 dict(id='E-Z2', repo=Z2, arquivo=ROTA, nota='exigida: funcionalidade trocada', antes="'tarefas.ver'", depois="'tarefas.concluir'"),
 dict(id='E-Z2b', repo=Z2, arquivo=ROTA, nota='variante: modulo trocado', antes="exigirModulo('zona2'", depois="exigirModulo('zona1'"),
 dict(id='E-Z3', repo=Z2, arquivo=ROTA, nota='exigida: remover o filtro de chave', antes="    if (id !== 'pendentes') return null\n", depois=''),
 dict(id='E-Z4', repo=Z2, arquivo=HT, nota='exigida: remover escapar', antes="<li>${escapar(t.titulo)}</li>", depois="<li>${t.titulo}</li>"),
 dict(id='E-Z4b', repo=Z2, arquivo=HT, nota='variante: escapar sem < e >', antes="texto.replace(/[&<>\"']/g", depois="texto.replace(/[&\"']/g"),
 dict(id='E-Z5', repo=Z2, arquivo=HT, nota='exigida: <script> no HTML do bloco (dono 500, zona 1 sem bloco)',
      antes="+ '<h2 id=", depois="+ '<script>1</script><h2 id="),
 dict(id='E-Z5b', repo=Z2, arquivo=HT, nota='variante (contorno): <img/onerror> no HTML do bloco',
      antes="+ '<h2 id=", depois="+ '<img/onerror=alert(1) src=x><h2 id="),
 dict(id='E-Z6', repo=Z2, arquivo=HT, nota='variante: filtro !concluida removido', antes="tarefas.filter((t) => !t.concluida)", depois="tarefas"),
 dict(id='E-Z6b', repo=Z2, arquivo=HT, nota='variante: filtro invertido', antes="tarefas.filter((t) => !t.concluida)", depois="tarefas.filter((t) => t.concluida)"),
 dict(id='E-U1', repo=Z1, arquivo=PG, nota='variante: embute sem checar null', antes=DIV, depois="<div dangerouslySetInnerHTML={{ __html: tarefas ?? '' }} />"),
 dict(id='E-U1b', repo=Z1, arquivo=PG, nota='variante: placeholder no lugar da ausencia (copia do padrao dos outros blocos)',
      antes=DIV, depois="{tarefas ? <div dangerouslySetInnerHTML={{ __html: tarefas }} /> : <p>Tarefas indisponíveis no momento.</p>}"),
 dict(id='E-U2', repo=Z1, arquivo=FR, nota='variante: cookie nao repassado', antes="lerCookieDeSessao: async () => (await cookies()).get('__Host-session')?.value",
      depois="lerCookieDeSessao: async () => { await cookies(); return undefined }"),
 dict(id='E-U2b', repo=Z1, arquivo=FR, nota='variante: nome de cookie errado', antes="get('__Host-session')", depois="get('session')"),
 dict(id='E-U3', repo=Z1, arquivo=PG, nota='variante: ordem do Promise.all trocada', antes="const [recursos, indicadores, tarefas] = await Promise.all([", depois="const [recursos, tarefas, indicadores] = await Promise.all(["),
 dict(id='E-U5', repo=Z1, arquivo=FR, nota='variante: origem apontando para o shell', antes="'http://127.0.0.1:3002'", depois="'http://127.0.0.1:3000'"),
 dict(id='E-U5b', repo=Z1, arquivo=FR, nota='variante: fragmento fora da allowlist', antes="fragmentos: ['tarefas']", depois="fragmentos: []"),
]
for x in m: x['modos'] = ['e2e']
json.dump(m, open('e2e.json', 'w'), ensure_ascii=False, indent=1)
