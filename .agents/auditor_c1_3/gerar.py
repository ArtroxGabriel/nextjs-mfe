"""Gera veto.json (etapa 2), variantes.json (etapa 3) e familias.json (etapa 4) do auditor_c1_3. Uso: python3 -I gerar.py"""
import json
A2 = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/.agents/auditor_c1_2'
ant = {m['id']: m for f in ('veto', 'variantes', 'familias') for m in json.load(open(f'{A2}/{f}.json'))}
Z1 = 'repos/erp-zona-1'; PG = 'app/zona1/page.tsx'; LY = 'app/layout.tsx'
DIV = "{tarefas && <div dangerouslySetInnerHTML={{ __html: tarefas }} />}"
def e(**k): k.setdefault('modos', ['e2e']); k.setdefault('repo', Z1); k.setdefault('arquivo', PG); return k
def troca(id, nota, depois): return e(id=id, nota=nota, antes=DIV, depois="{tarefas ? <div dangerouslySetInnerHTML={{ __html: tarefas }} /> : " + depois + "}")
veto = [ant[i] for i in ('V-U1c', 'V-U1d', 'V-U1f', 'V-Z4e', 'E-U1b', 'V-U1h')]
REC_FIM = "          : <p>Recursos indisponíveis no momento.</p>}\n      </section>"
IND_FIM = "          : <p>Indicadores indisponíveis no momento.</p>}\n      </section>"
LY_ANTES = "<body><MolduraOuAviso>{children}</MolduraOuAviso></body>"
LY_IMP = "import { dadosDaMoldura } from '@/lib/pagina'"
LY_FN = "  return (\n    <html lang=\"pt-BR\">"
def layout(id, nota, texto):
    return e(id=id, nota=nota, arquivo=LY, antes=LY_ANTES,
             depois="<body><MolduraOuAviso>{children}</MolduraOuAviso>{!z2 && <p>" + texto + "</p>}</body>",
             subs=[[LY_IMP, "import { dadosDaMoldura, acessoEfetivo } from '@/lib/pagina'"],
                   [LY_FN, "  const z2 = await acessoEfetivo().then((a) => a.modulos.some((m) => m.id === 'zona2'), () => true)\n" + LY_FN]])
variantes = [
 troca('X-T1', 'template no lugar do bloco', "<template>Bloco indisponível no momento.</template>"),
 troca('X-T2', 'p hidden no lugar do bloco', "<p hidden>Bloco indisponível no momento.</p>"),
 troca('X-T3', 'span aria-hidden no lugar do bloco', "<span aria-hidden=\"true\">—</span>"),
 troca('X-T4', 'div vazia com comentario HTML (dangerouslySetInnerHTML)', "<div dangerouslySetInnerHTML={{ __html: '<!-- bloco indisponivel -->' }} />"),
 troca('X-T5', 'texto solto entre secoes', "'Bloco indisponível no momento.'"),
 troca('X-T6', 'link "Abrir as tarefas" isolado', "<a href=\"/zona2\">Abrir as tarefas</a>"),
 troca('X-T7', 'link neutro isolado para /zona2', "<p><a href=\"/zona2\">Abrir</a></p>"),
 troca('X-T8', 'hr no lugar do bloco (elemento vazio)', "<hr />"),
 e(id='X-S1', nota='placeholder neutro dentro da section de recursos', antes=REC_FIM,
   depois="          : <p>Recursos indisponíveis no momento.</p>}\n        {!tarefas && <p>Bloco indisponível no momento.</p>}\n      </section>"),
 e(id='X-S2', nota='placeholder com texto natural dentro da section de recursos', antes=REC_FIM,
   depois="          : <p>Recursos indisponíveis no momento.</p>}\n        {!tarefas && <p>Tarefas indisponíveis no momento.</p>}\n      </section>"),
 e(id='X-S3', nota='placeholder travessao dentro da section de indicadores', antes=IND_FIM,
   depois="          : <p>Indicadores indisponíveis no momento.</p>}\n        {!tarefas && <p>—</p>}\n      </section>"),
 layout('X-L1', 'placeholder neutro no layout, fora do <main>, condicionado ao modulo zona2', 'Bloco indisponível no momento.'),
 layout('X-L2', 'placeholder com texto natural no layout, fora do <main>', 'Tarefas indisponíveis no momento.'),
 e(id='X-H1', nota='texto neutro dentro do h1 quando falta o bloco', antes="<h1>Painel da zona 1</h1>",
   depois="<h1>Painel da zona 1{!tarefas && ' (bloco indisponível)'}</h1>"),
 # falsos positivos: mudancas inocentes que a checagem estrutural nao pode reprovar
 e(id='F-1', nota='controle: atributo novo na section de recursos', antes='<section aria-labelledby="recursos">', depois='<section aria-labelledby="recursos" className="recursos">'),
 e(id='F-2', nota='controle: texto do h2 de indicadores trocado', antes='Indicadores (domínio B)</h2>', depois='Indicadores do domínio B</h2>'),
 e(id='F-3', nota='controle: link de relatorios com title (bruno)', antes='<p><a href="/zona1/relatorios">Relatórios</a></p>', depois='<p><a href="/zona1/relatorios" title="relatorios">Relatórios</a></p>'),
 e(id='F-4', nota='controle: <br /> dentro da section de recursos (elemento vazio aninhado)', antes='<h2 id="recursos">Recursos (domínio A)</h2>', depois='<h2 id="recursos">Recursos (domínio A)</h2><br />'),
]
familias = [ant[i] for i in ('R-S1', 'R-S2', 'R-E-S1', 'R-E-P3', 'R-E-Z1', 'R-E-Z2', 'R-E-Z3', 'R-E-Z5', 'R-E-U2', 'R-T-A5', 'R-T-U4', 'R-T-U4b',
                             'E-Z4', 'E-Z4b', 'E-Z6', 'E-Z6b', 'V-Z4c', 'V-Z6c')]
for n, l in [('veto', veto), ('variantes', variantes), ('familias', familias)]:
    json.dump(l, open(f'{n}.json', 'w'), ensure_ascii=False, indent=1)
print(len(veto), len(variantes), len(familias))
