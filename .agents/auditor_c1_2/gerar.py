"""Gera veto.json (etapa 2), variantes.json (etapa 3) e familias.json (etapa 4). Uso: python3 -I gerar.py"""
import json
SH='repos/erp-shell'; Z2='repos/erp-zona-2'; Z1='repos/erp-zona-1'
ROTA="app/zona2/%5Ffragmento/tarefas/[id]/route.ts"; HT='lib/fragmento-tarefas.ts'; PG='app/zona1/page.tsx'; FR='lib/fragmentos.ts'
DIV="{tarefas && <div dangerouslySetInnerHTML={{ __html: tarefas }} />}"
LI="<li>${escapar(t.titulo)}</li>"; FILTRO="tarefas.filter((t) => !t.concluida)"
def e(**k): k.setdefault('modos', ['e2e']); return k
veto = [
 e(id='E-Z4', repo=Z2, arquivo=HT, nota='veto: remover escapar', antes=LI, depois="<li>${t.titulo}</li>"),
 e(id='E-Z4b', repo=Z2, arquivo=HT, nota='veto: escapar sem < e >', antes="texto.replace(/[&<>\"']/g", depois="texto.replace(/[&\"']/g"),
 e(id='E-Z6', repo=Z2, arquivo=HT, nota='veto: filtro !concluida removido', antes=FILTRO, depois="tarefas"),
 e(id='E-Z6b', repo=Z2, arquivo=HT, nota='veto: filtro invertido', antes=FILTRO, depois="tarefas.filter((t) => t.concluida)"),
 e(id='E-U1b', repo=Z1, arquivo=PG, nota='veto: placeholder no lugar da ausencia', antes=DIV,
   depois="{tarefas ? <div dangerouslySetInnerHTML={{ __html: tarefas }} /> : <p>Tarefas indisponíveis no momento.</p>}"),
]
SEC_INI="  return '<section data-fragmento"; SEC_FIM="</a></p></section>`"
variantes = [
 e(id='V-Z4c', repo=Z2, arquivo=HT, nota='variante: escape so de & e <', antes="texto.replace(/[&<>\"']/g", depois="texto.replace(/[&<]/g"),
 e(id='V-Z4d', repo=Z2, arquivo=HT, nota='variante: escape no HTML inteiro do bloco, nao no titulo', antes=LI, depois="<li>${t.titulo}</li>",
   subs=[[SEC_INI, "  return escapar('<section data-fragmento"], [SEC_FIM, SEC_FIM + ')']]),
 e(id='V-Z4e', repo=Z2, arquivo=HT, nota='variante: escape na lista inteira (corpo), nao no titulo', antes=LI, depois="<li>${t.titulo}</li>",
   subs=[["  const corpo = pendentes.length", "  const corpo = escapar(pendentes.length"], ["'<p>Nenhuma tarefa pendente.</p>'\n", "'<p>Nenhuma tarefa pendente.</p>')\n"]]),
 e(id='V-Z4f', repo=Z2, arquivo=HT, nota='variante: escape sem aspas (so & < >)', antes="texto.replace(/[&<>\"']/g", depois="texto.replace(/[&<>]/g"),
 e(id='V-Z6c', repo=Z2, arquivo=HT, nota='variante: filtro mostra so concluidas (=== true)', antes=FILTRO, depois="tarefas.filter((t) => t.concluida === true)"),
 e(id='V-Z6d', repo=Z2, arquivo=HT, nota='variante: filtro por versao (versao === 1) no lugar de concluida', antes=FILTRO,
   depois="tarefas.filter((t) => (t as unknown as { versao: number }).versao === 1)"),
 e(id='V-Z6e', repo=Z2, arquivo=HT, nota='variante: filtro por versao (versao < 3) no lugar de concluida', antes=FILTRO,
   depois="tarefas.filter((t) => (t as unknown as { versao: number }).versao < 3)"),
 e(id='V-U1c', repo=Z1, arquivo=PG, nota='variante: placeholder "Bloco indisponivel no momento."', antes=DIV,
   depois="{tarefas ? <div dangerouslySetInnerHTML={{ __html: tarefas }} /> : <p>Bloco indisponível no momento.</p>}"),
 e(id='V-U1d', repo=Z1, arquivo=PG, nota='variante: placeholder travessao', antes=DIV,
   depois="{tarefas ? <div dangerouslySetInnerHTML={{ __html: tarefas }} /> : <p>—</p>}"),
 e(id='V-U1e', repo=Z1, arquivo=PG, nota='variante: section vazia com titulo "Tarefas (zona 2)"', antes=DIV,
   depois="{tarefas ? <div dangerouslySetInnerHTML={{ __html: tarefas }} /> : <section aria-labelledby=\"tarefas\"><h2 id=\"tarefas\">Tarefas (zona 2)</h2></section>}"),
 e(id='V-U1f', repo=Z1, arquivo=PG, nota='variante: section vazia com titulo "Pendências"', antes=DIV,
   depois="{tarefas ? <div dangerouslySetInnerHTML={{ __html: tarefas }} /> : <section aria-labelledby=\"pendencias\"><h2 id=\"pendencias\">Pendências</h2></section>}"),
 e(id='V-U1g', repo=Z1, arquivo=PG, nota='variante: fragmento embrulhado em titulo "Zona 2" fora do condicional', antes=DIV,
   depois="<section aria-labelledby=\"zona2\"><h2 id=\"zona2\">Zona 2</h2>{tarefas && <div dangerouslySetInnerHTML={{ __html: tarefas }} />}</section>"),
 e(id='V-U1h', repo=Z1, arquivo=PG, nota='controle (equivalente): embrulho "Zona 2" dentro do condicional', antes=DIV,
   depois="{tarefas && <section aria-labelledby=\"zona2\"><h2 id=\"zona2\">Zona 2</h2><div dangerouslySetInnerHTML={{ __html: tarefas }} /></section>}"),
]
familias = [
 e(id='R-S1', repo=SH, arquivo='lib/decisao-proxy.ts', nota='familia guarda do shell (unidade)', antes="    if (ehFragmento(caminho)) return { acao: 'nao-encontrado' }\n", depois='', modos=['unit']),
 e(id='R-S2', repo=SH, arquivo='lib/decisao-proxy.ts', nota='familia guarda do shell (unidade): sem /i', antes='const FRAGMENTO = /^\\/[^/]+\\/_fragmento(?:\\/|$)/i', depois='const FRAGMENTO = /^\\/[^/]+\\/_fragmento(?:\\/|$)/', modos=['unit']),
 e(id='R-E-S1', repo=SH, arquivo='lib/decisao-proxy.ts', nota='familia guarda do shell (ponta a ponta)', antes="    if (ehFragmento(caminho)) return { acao: 'nao-encontrado' }\n", depois=''),
 e(id='R-E-P3', repo=SH, arquivo='proxy.ts', nota='familia guarda do shell: nao-encontrado segue para a zona',
   antes="return new NextResponse(null, { status: 404, headers: { 'cache-control': 'no-store' } })", depois='return NextResponse.next()'),
 e(id='R-E-Z1', repo=Z2, arquivo=ROTA, nota='familia exigirModulo: removido', antes="    await nucleo.acesso.exigirModulo('zona2', 'tarefas.ver')\n", depois=''),
 e(id='R-E-Z2', repo=Z2, arquivo=ROTA, nota='familia exigirModulo: funcionalidade trocada', antes="'tarefas.ver'", depois="'tarefas.concluir'"),
 e(id='R-E-Z3', repo=Z2, arquivo=ROTA, nota='familia chave pendentes: filtro removido', antes="    if (id !== 'pendentes') return null\n", depois=''),
 e(id='R-E-Z5', repo=Z2, arquivo=HT, nota='familia <script> no bloco', antes="+ '<h2 id=", depois="+ '<script>1</script><h2 id="),
 e(id='R-E-U2', repo=Z1, arquivo=FR, nota='familia zona 1: cookie nao repassado', antes="lerCookieDeSessao: async () => (await cookies()).get('__Host-session')?.value",
   depois="lerCookieDeSessao: async () => { await cookies(); return undefined }"),
 e(id='R-T-A5', repo='', arquivo='base/scripts/ambiente.mjs', nota='familia ZONA2_URL fora da lista', antes="'DOMINIO_C_URL', 'ZONA2_URL',", depois="'DOMINIO_C_URL',", modos=['scripts']),
 e(id='R-T-U4', repo=Z1, arquivo=PG, nota='familia fetch direto no painel (N8)', antes="fragmentos.buscar('zona2', 'tarefas', 'pendentes'),",
   depois="fetch('http://127.0.0.1:3002/zona2/_fragmento/tarefas/pendentes').then((r) => r.text(), () => null),", modos=['estatica']),
 e(id='R-T-U4b', repo=Z1, arquivo=PG, nota='familia fetch direto no painel (N8): globalThis.fetch', antes="fragmentos.buscar('zona2', 'tarefas', 'pendentes'),",
   depois="globalThis.fetch('http://127.0.0.1:3002/zona2/_fragmento/tarefas/pendentes').then((r) => r.text(), () => null),", modos=['estatica']),
]
for n, l in [('veto', veto), ('variantes', variantes), ('familias', familias)]:
    json.dump(l, open(f'{n}.json', 'w'), ensure_ascii=False, indent=1)
print(len(veto), len(variantes), len(familias))
