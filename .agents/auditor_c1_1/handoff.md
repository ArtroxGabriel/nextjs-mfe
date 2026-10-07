# Handoff auditor_c1_1 (final)

## Veredito: VETO (só por teste)

Estado sob teste: principal `8182e2f`; shell `836ddc4`; zona 1 `39c4b76`; zona 2 `1626fd1`; núcleo `610217d` (0.10.3).
Mutações em `mutacoes.txt` (repositório, arquivo:linha, antes/depois, comando e resultado). Scripts: `mutar.py` (aplica,
roda, restaura com `git checkout`), as listas `*.json` (`gerar_shell.py` e `gerar_e2e.py` as geram), `sonda.mjs`, `sonda2.mjs`, `inerte.mjs`.
Saídas brutas em `saidas/`, com cookie e JWT mascarados (nenhum ficou na pasta).

O veto vem de três erros plausíveis de boa-fé que nenhum teste pega. Nenhum deles é defeito no código entregue: o
código está certo, mas a correção pedida mexe só em teste, ou em teste mais semente do stub (ver "Correção pedida").

## Etapas (todas feitas)
1. Leitura: LEIA-PRIMEIRO ("Como um gate funciona"), AMBIENTE, o plano C1, o ADR-0011 com o adendo 1, os handoffs do
   revisor_c1_1 e do challenger_c1_1, e o método do auditor_d7_1 (`aa26ba2`).
2. Linha de base: shell `pnpm test` 116/116; C1a–C1d 4/4.
3. Unidade, `lib/decisao-proxy.ts` (13 mutações): 11 pegas, 2 vivas (S5d, S5e).
4. Ponta a ponta, `CONSTRUIR=1 --test-name-pattern='C1[a-d]'` (21 mutações): 14 pegas, 7 vivas. As vivas que pesam
   (E-Z4, E-Z6, E-U1b) também rodaram contra o `base.test.mjs` inteiro e continuaram vivas (68 verdes).
5. Estáticas e scripts (5 mutações): 5 pegas.
6. Caso extra `ehHtmlInerte` (`saidas/inerte-saida.txt`): resultado na seção própria abaixo.
7. Restauração e regressão: submódulos limpos e builds refeitos no estado original (`precisaConstruir` dá false nas 3 apps).

Total: 39 mutações, 30 pegas e 9 vivas.

## Mutações exigidas pelo plano
- `ehFragmento`: remover a chamada (S1 e E-S1), tirar o `/i` (S2), tirar o `decodeURIComponent` (S3), mover para depois
  da sonda (S4a) e para depois do cookie (S4b). Todas pegas pela unidade C1. A E-S1 também é pega pelo C1b.
- `exigirModulo`: removido (E-Z1) e funcionalidade `tarefas.concluir` (E-Z2), ambas pegas pelo C1a.
- `if (id !== 'pendentes')` removido (E-Z3): pego pelo C1a.
- `<script>` no bloco (E-Z5): o dono responde 500 e a zona 1 fica sem o bloco. C1a, C1c e C1d reprovam.
- **`escapar` removido (E-Z4): VIVA.**
- `fetch` direto no painel (T-U4): a N8 pega. As variantes `globalThis.fetch`, `globalThis['fetch']` e `fetch` injetado
  no `criarFragmento` também são pegas.
- `ZONA2_URL` fora de `AMBIENTE_PERMITIDO.zona` (T-A5): o V1 de `base/scripts/ambiente.test.mjs` pega. Nota: só esse
  teste pega, porque o padrão da zona 1 (`127.0.0.1:3002`) é a porta real. O `task verificar` não o roda; ele roda em `task scripts:test`.

Variantes pegas: E-P1, E-P2 e E-P3 (404 com corpo, 404 sem `no-store`, `nao-encontrado` seguindo para a zona; o C1b
pega as três), E-Z2b (módulo trocado), E-U2 e E-U2b (cookie não repassado, nome do cookie errado), E-U3 (ordem do
`Promise.all`; o build falha por tipo), E-U5 (origem apontando para o shell), E-U5b (fragmento fora da allowlist),
S4c, S5a, S5b, S5c, S5f e S5g.

## Mutações vivas e classificação (regra A2)
- **E-Z4, `escapar` removido: conta para o veto.** É erro plausível de boa-fé: o plano e o comentário do código dizem
  que "o núcleo confere [inerte] nas duas pontas", e quem simplifica tira o escape por achar que é redundante. A
  `sonda.mjs` mediu o efeito com títulos hostis no domínio C (`saidas/sonda-E-Z4.txt` e, para comparar,
  `sonda-original.txt`). Com o escape, o painel mostra `&lt;img/onerror…&gt;`. Sem o escape, o painel da zona 1 recebe
  cru `<img/onerror=alert(1) src=x>` e `<meta http-equiv=refresh content="0;url=https://exemplo.invalid/">`, que passam
  pelo `ehHtmlInerte` nas duas pontas. A CSP bloqueia o handler, mas nenhuma diretiva dela cobre o meta refresh
  (redirecionamento para fora a partir do painel). Hoje o escape é a única camada contra marcação vinda do domínio.
- **E-Z4b, `escapar` sem `<` e `>`: conta para o veto.** Mesma classe da E-Z4; a mesma correção a pega.
- **E-U1b, placeholder "Tarefas indisponíveis no momento." no lugar da ausência: conta para o veto.** Fere o
  invariante 8 e é plausível, porque copia o padrão dos dois blocos vizinhos na mesma página. Bruno e davi veem o texto
  (`saidas/sonda2-E-U1b.txt`). O C1c só procura `Tarefas pendentes` e `sem acesso|não autorizado|acesso negado`.
- **E-Z6 e E-Z6b, filtro `!t.concluida` removido ou invertido: contam para o veto (defeito funcional, sem
  segurança).** Uma tarefa concluída aparece em "pendentes", ou só as concluídas aparecem. Nenhum teste confere o
  título de uma tarefa.
- E-U1, `div` sem checar `null`: limite declarado. Para quem não tem o módulo, rende um `<div></div>` vazio, sem texto
  e sem dado: é equivalente na prática.
- E-Z5b, `<img/onerror>` escrito à mão no HTML do bloco: contorno deliberado, que vira limite declarado. Ela mostra o
  buraco do núcleo (seção abaixo); a C1a usa o mesmo regex `\son…` e também não a vê.
- S5d, `decodeURI` no lugar de `decodeURIComponent`: equivalente na prática. Pela sonda,
  `/zona2/_fragmento%2Ftarefas%2Fpendentes` dá 404 direto na zona 2.
- S5e, `%` solto vira "não é fragmento": não alcança nada. Pela sonda, `/zona2/_fragmento/tarefas/pendentes%` e
  `/zona2/_fragmento/tarefas/%zz` dão 500 direto na zona 2, sem bloco. Limite declarado.

## Correção pedida (só teste, mais a semente do stub; o orquestrador decide se a semente conta como teste)
1. Pôr na semente do domínio C uma tarefa pendente com `<`, `&` e `"` no título e uma tarefa concluída. A outra opção
   é um teste que suba o domínio C com `DADOS_DIR` próprio, como faz a `sonda.mjs`. Os outros testes só usam `t-1` e
   `t-2` pelo id.
2. Nos testes:
   - no C1a (e no C1c), conferir o título escapado (`&lt;`, `&amp;`) e a ausência dele cru;
   - conferir que a concluída não aparece e que uma pendente real aparece;
   - atenção: no `base.test.mjs` inteiro, a `t-1` já foi concluída quando o C1 roda.
3. No C1c, para bruno e davi, `assert.doesNotMatch(s.html, /tarefa|zona 2/i)`. Na linha de base os dois não têm nenhuma
   ocorrência (`saidas/sonda2-original.txt`), então o teste tem dentes sem falso positivo.

A prova é reaplicar E-Z4, E-Z4b, E-Z6, E-Z6b e E-U1b. Se a correção mexer só em teste, a iteração seguinte é só um
auditor novo.

## Caso extra: `ehHtmlInerte` (núcleo 0.10.3, anterior ao C1)
- O `ATIVO` exige espaço antes de `on…=`. Por isso passam como inertes:
  - `<img/onerror=…>`, `<svg/onload=…>`, `<body/onload=…>`, `<details/open/ontoggle=…>`, `<svg><set/onbegin=…>`;
  - atributo colado em aspas (`src="x"onerror=…`);
  - `jav&#x61;script:`, `javascript&colon;` e tab no meio do esquema;
  - `<meta http-equiv=refresh>`, `<base>`, `<form action=//…>`, `<link rel=stylesheet>`, `<style>` e `<img src=//…>`.
- A CSP das zonas (`criarProxy` → `politicaDeSeguranca`, confirmada no cabeçalho do painel) neutraliza quase tudo:
  - `script-src 'self' 'nonce-…' 'strict-dynamic'`, sem `unsafe-inline`, bloqueia handler inline e `javascript:`;
  - `base-uri 'none'`, `form-action 'self'`, `img-src 'self' data:` e `style-src` com nonce bloqueiam o resto.
- **O meta refresh escapa a tudo.**
- Classificação: é defeito de produto do núcleo, de defesa em profundidade, e fica fora do escopo do C1. Entra no
  `DEFERRED.md`, com correção na próxima versão do núcleo (0.10.4, em lockstep nas quatro apps). A correção:
  - `[\s/"']` antes de `on`;
  - decodificar entidades e retirar espaço em branco antes de procurar `javascript:`;
  - recusar `meta`, `base`, `link`, `style` e `form`;
  - de preferência uma allowlist de tags e atributos.
- Não bloqueia o C1 sozinho, porque o dono escapa e a CSP impede a execução. Mas é por causa dele que a E-Z4 viva pesa.

## Regressão final (estado original)
- shell `pnpm test`: 116/116;
- C1a–C1d: 4/4;
- `task verificar`: 123 = 119 passando + 4 pulados, 0 falhas;
- `task verificar:redis`: 123/123;
- `task verificar:estatica`: 51/51.

## Árvores e portas
- Árvores: shell, zona 1, zona 2 e núcleo limpos (`git status --short` vazio). O principal só tem o que já estava fora
  de commit (docs do humano e os ponteiros e lockfiles de `erp-dominio-stub` e `erp-moldura`) mais esta pasta.
- Portas: 3000–3003 e 4001–4120 livres, sem `next-server` nem `servidor.mjs` vivo. Redis, Keycloak e Verdaccio não
  foram tocados.
- Incidente, já resolvido: uma sonda com `| head` morreu por SIGPIPE antes do `derrubar()` e deixou a base de pé, com a
  zona 2 mutada. Derrubei os grupos de processos dela e refiz os builds. Cabe em `AMBIENTE.md`: não canalizar a saída
  de um script que sobe a base para `head`.
