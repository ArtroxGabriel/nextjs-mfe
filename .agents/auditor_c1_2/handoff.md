# Handoff auditor_c1_2 (final)

## Veredito: VETO (só por teste)

As 5 do veto da iteração 1 estão pegas e a regressão está verde. Mas a classe "placeholder no lugar da ausência"
(invariante 8) continua aberta: o teste novo pega só o texto da E-U1b (`/tarefa|zona 2/i`), não a classe. Três
variantes de boa-fé, com outro texto, passam e foram vistas ao vivo por bruno e davi. Há ainda uma variante funcional
menor no escape. Nenhum defeito no código entregue: a correção é só de teste.

## Correção pedida (só teste, em `base/verificacao/base.test.mjs`)
1. C1c, para bruno e davi: em vez de (ou além de) procurar palavras, conferir a ausência pela estrutura. Na linha de
   base o `</section>` da seção de recursos é seguido direto pelo botão de aviso (`saidas/sonda3-original.txt`), por
   exemplo: `const i = s.html.indexOf('</section>', s.html.indexOf('id="recursos"'));
   assert.match(s.html.slice(i), /^<\/section><button type="button">/, `${u}: elemento no lugar do bloco da zona 2`)`.
   Pega V-U1c, V-U1d, V-U1f e as antigas E-U1b/E-U1 (div vazia), sem depender do texto.
2. `tarefasDoBloco`: conferir o título dentro do item, `html.includes(`<li>${T3_ESCAPADO}</li>`)`. Pega V-Z4e.
Prova: reaplicar V-U1c, V-U1d, V-U1f, V-Z4e e E-U1b (comandos e trechos em `mutacoes.txt`); a iteração seguinte pode
ser de novo só um auditor.

Iteração 2 do gate do C1 (veto só por teste). Só o auditor. Scripts e saídas no scratchpad até o fim; copiados para cá no fim.

## Etapas
1. [x] Só teste/dados: fora de `.agents/`, `8182e2f..1edc130` mexe só em `base/verificacao/base.test.mjs` (+11 linhas:
   `T3_ESCAPADO`, `tarefasDoBloco` em C1a e C1c, `doesNotMatch /tarefa|zona 2/i` para bruno e davi) e no ponteiro do stub
   (`962932c` → `b85540c`). Stub `962932c..b85540c`: só `dados/semente/dominio-c.json` (+t-3, +t-4) e
   `test/armazem.test.mjs` (2 → 4). Ponteiros de shell, zona 1, zona 2 e núcleo iguais aos da iteração 1.
   Linha de base C1 (`--test-name-pattern='C1'`): 5/5.
2. [x] Veto reaplicado, as 5 PEGAS (`CONSTRUIR=1 node --test --test-name-pattern='C1' base/verificacao/base.test.mjs`):
   - E-Z4 e E-Z4b: C1a e C1c, "ana: pendente t-3 ausente ou sem escape" e "ana no painel: …";
   - E-Z6: C1a e C1c, "tarefa concluida no bloco de pendentes";
   - E-Z6b: C1a e C1c, "pendente t-3 ausente ou sem escape";
   - E-U1b: C1c, "bruno: rastro do bloco da zona 2 sem o modulo".
3. [x] Variantes (13): 7 pegas, 6 verdes (uma é controle equivalente). Pegas: V-Z4c (escape só `&` e `<`), V-Z4d (escape
   no HTML inteiro do bloco), V-Z4f (escape sem aspas), V-Z6c (só concluídas, `=== true`), V-Z6e (filtro `versao < 3`),
   V-U1e (`<section>` vazia com título "Tarefas (zona 2)"), V-U1g (título "Zona 2" fora do condicional).
   Vivas, conferidas ao vivo com `sonda3.mjs`/`sonda4.mjs` (saídas `sonda3-*.txt`, `sonda4-V-Z4e.txt`):
   - V-U1c placeholder "Bloco indisponível no momento.": bruno e davi recebem `<p>Bloco indisponível no momento.</p>`
     logo depois da seção de recursos. BOA-FÉ (mesma classe da E-U1b, só outro texto; fere o invariante 8). VETO.
   - V-U1d placeholder `<p>—</p>`: bruno e davi recebem o travessão. BOA-FÉ (mesma classe). VETO.
   - V-U1f `<section>` vazia com título "Pendências": bruno e davi recebem a seção vazia. BOA-FÉ (mesma classe). VETO.
   - V-Z4e escape aplicado à lista inteira (`corpo`) e não ao título: ana vê `&lt;ul&gt;&lt;li&gt;…` como texto, a
     lista vira marcação literal. Sem risco de segurança (continua escapado), defeito funcional visível, mesma classe
     das E-Z6 que contaram para o veto. BOA-FÉ, menor. VETO.
   - V-Z6d filtro `versao === 1` no lugar de `concluida`: CONTORNO (ninguém filtra pendentes por versão de boa-fé);
     limite declarado (A2).
   - V-U1h (controle): embrulho "Zona 2" dentro do condicional, equivalente; verde, sem falso positivo.
   Linha de base da sonda (`sonda3-original.txt`): para bruno e davi, o `</section>` da seção de recursos é seguido
   direto por `<button type="button">Avisar no toast do shell</button>`.
4. [x] Regressão por família: 12 de 12 continuam pegas, pelos mesmos testes da iteração 1 — guarda do shell (R-S1 e
   R-S2 na unidade; R-E-S1 e R-E-P3 no C1b), `exigirModulo` (R-E-Z1: C1a e C1c; R-E-Z2: C1a), chave `pendentes`
   (R-E-Z3: C1a), `<script>` no bloco (R-E-Z5: C1a, C1c, C1d), cookie não repassado (R-E-U2: C1c, C1d), `ZONA2_URL`
   fora da lista (R-T-A5: V1 de `ambiente.test.mjs`), `fetch` direto no painel (R-T-U4 e R-T-U4b: N8).
5. [x] Regressão completa no estado original (depois de `CONSTRUIR=tudo` com C1 5/5): `task test` 20 + 271 + 26 +
   75 (stub) + 116 (shell), 0 falhas; `task verificar` 123 = 119 + 4 pulados, 0 falhas; `task verificar:redis`
   123/123; `task verificar:estatica` 51/51. Saídas `saidas/regressao-*.txt`.
6. [x] Restauração: toda mutação restaurada por `git checkout` (o `mutar.py` restaura no `finally`; as sondas, à mão).
   `git status --short` vazio em shell, zona 1, zona 2 e núcleo; stub só com `pnpm-lock.yaml` local; principal só com
   o que já estava fora de commit mais esta pasta. Builds refeitos no estado original (`CONSTRUIR=tudo`, C1 5/5) e
   nenhuma mutação depois disso. Base derrubada; portas 3000–3003 e 4001–4120 livres; nenhum `next-server` nem
   `servidor.mjs`; Redis, Keycloak e Verdaccio de pé e intocados. Nenhum JWT ou cookie nas saídas (grep). Sem commit.

Totais: 30 mutações (5 do veto, 13 variantes, 12 de regressão): 24 pegas, 6 verdes (4 boa-fé → veto; 1 contorno →
limite declarado; 1 controle equivalente).

Arquivos: `mutacoes.txt` (cada mutação: repositório, arquivo:linha, antes/depois, comando, resultado); `mutar.py`
(cópia do da iteração 1 com `subs` para mais de duas trocas e padrão `C1`); `gerar.py` → `veto.json`,
`variantes.json`, `familias.json`; `sonda3.mjs` (o que vem depois da seção de recursos no painel) e `sonda4.mjs` (o
bloco como ana o vê); `saidas/`.
