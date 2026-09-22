# auditor_shell_2: gate "Shell novo (Gabriel)", iteração 2

**Veredito: INTEGRITY VIOLATION** (veto)

Escopo: `erp-shell` `a63b995..4255635` (correção `f3d8803`), `erp-zona-1` `a0d9bc1`, `erp-zona-2` `831d128`,
`erp-zona-acesso` `b24b078`, `base/verificacao/base.test.mjs` (L1–L4, N8 endurecido) e `base/scripts/ambiente.mjs`
(`derrubarApp`/`subirApp`), como estavam às 19:50. Todas as mutações rodaram numa cópia
(`scratchpad/aud2/copia/{repos,base}`). A árvore real não foi editada. A tabela completa está em `mutacoes.txt`; os
scripts, os testes mínimos e as saídas estão em `anexos/`.

**Mudanças durante a auditoria (fora do escopo, não auditadas):** entraram no principal `b6c8a56`, `09f11cb`, `bea80cb`
(N8 por análise estrutural, testes com navegador, `CONSTRUIR=tudo`) e `915b3a0`. O `erp-shell` foi a `6d93f8e`
("zone ids must be lowercase; remove __Host-flash with Secure"), que ainda não está fixado no principal: `git status`
mostra ` M repos/erp-shell` e ` M .gitmodules`, e não fui eu. Esses commits atacam três lacunas que relato abaixo
(C1c, F8, N8). **A lacuna que sustenta o veto (V1) continua na árvore atual.**

## Números reproduzidos
- Unidade do shell: **29/29**, na árvore real e na cópia.
- e2e `node --test base/verificacao/*.test.mjs` na cópia com `CONSTRUIR=1`: **30/30**, 35 s, com as quatro apps reconstruídas.

## Por que é veto

### V1. Fail-open do `exigirModulo` na zona 2 passa por todas as suítes
Voltei `lib/pagina.ts` de **uma** app por vez à versão da iteração 1:

| App | Resultado |
|---|---|
| zona 1 | pega (L1/V1) |
| **zona 2** | **sobrevive**: unidade 29/29, e2e 30/30 |
| zona de acesso | equivalente: a página lê o catálogo da própria gestão de acesso, que está fora |
| shell | equivalente: a página chama `modulosPermitidos()` de novo e lança |

Com a gestão de acesso fora e o fail-open só na zona 2, **davi, que não tem `zona2.tarefas`, recebe as tarefas no HTML
de `/zona2`**. Meu teste G1 reprova com `davi /zona2: tarefas chegaram com a gestao de acesso fora`. É exatamente o
vazamento vetado na iteração 1. `atual.md` §8 afirma "sem ele ninguém entra em módulo", e §7 afirma que o e2e protege
"gestão de acesso fora sem vazar módulo no payload". O L1 só visita `/zona1` e `/zona1/relatorios`, e o D4 só procura
`Olá,` e `Painel da zona 1</h1>`.

Os commits `831d128` (zona 2) e `b24b078` (acesso) dizem "repos/verificacao L1 fails with the old code and passes with
this". **Para a zona 2 isso é falso**: o L1 não toca a zona 2. É uma correção declarada como protegida sem estar.

### Afirmações declaradas que ficam sem teste (sozinhas não dariam veto, mas somam)
- **CSP do shell** (achado 2 do reviewer_shell_1, dado como resolvido; §1.1 "com CSP e nonce" nas rotas públicas):
  tirar `form-action`, tirar `img-src` ou servir `/login` sem CSP (M17) deixa tudo verde. O e2e só confere o nonce.
- **Telemetria:** repassar ao coletor o lote recusado com 429 (T4b2) e aceitar e repassar corpo não-JSON (T4c)
  passam. O L4 não conta os lotes do coletor depois do 61º, e ninguém envia corpo não-JSON (achado 3 do revisor).
- **Sonda (§1.1):** timeout de 500 ms (M14/M14b), "status ≥ 500 = fora" (M15) e "asset estático só depois da
  sonda" (M13) continuam sem teste nenhum. O L2 mata a zona com SIGKILL, então a conexão é recusada na hora: ele não
  exercita timeout nem 5xx.
- **`__Host-flash` sem `Secure` (achado 1 do revisor):** confirmado ao vivo. `/` com o cookie de flash responde
  `Set-Cookie: __Host-flash=; Path=/; Max-Age=0`, sem `Secure`, e meu G3 **reprova no código do escopo**. Nenhuma
  suíte do repositório distingue a versão com `Secure` da versão sem, e remover o apagamento (M16) também passa.
  Fora do escopo, `6d93f8e` e o L5 novo tratam disso.
- **Id de zona com maiúscula (achado 2 do revisor):** confirmado. Com `carregarZonas({ ZonaA })`, os caminhos `/zonaa`,
  `/ZonaA` e `/ZONAA/x` não encontram zona, enquanto `gerarRewrites` gera `/ZonaA`. Meu U7 reprova no escopo.
  `6d93f8e` trata disso.
- **N8 endurecido:** das nove formas indiretas que pedi, o regex pega só `globalThis.fetch` e `self.fetch(`.
  Passam `Reflect.get(globalThis,'fetch')`, `import('node:http')`, `fetch (`, `fetch.call`, `const { fetch: f } =
  globalThis`, `globalThis['fe'+'tch']`, `import … from 'node:https'`, além de `fetch\n(`, `XMLHttpRequest` e
  `undici`. **O próprio código tem um caso real:** `erp-shell/lib/saude-zonas.ts` usa `fetchFn: typeof fetch = fetch`,
  sai para a rede sem o registro e passa no N8 só por causa da forma. Isso contraria a regra de `AMBIENTE.md` §3
  ("todo contorno achado vira caso do teste"). `bea80cb` troca o regex por análise com o compilador; não auditei essa versão.

## O que agora morre (sobreviventes da iteração 1)
M3, M3b, M4b2, M4c, M5b (pelo L2), M10 (pelo L3), M8b (pelo L4), M6b/V2 (pelo L4, na forma nova T4a/T4a2) e o C1
de caminho (C1a: unidade + L2). Das variantes novas de TTL, M3c e M3d também morrem no L2.
Continuam vivos: M13, M14, M14b, M15, M17, M18, M20 (quase equivalente) e M11c (equivalente). Viraram equivalentes
M6a (a rota sai antes da função pura) e M7b (`lerComLimite` já devolve 413).

## Respostas às perguntas do pedido
| # | Mutação | Resultado |
|---|---|---|
| 1 | fail-open, uma app por vez | zona 1 pega (L1); **zona 2 sobrevive**; acesso e shell equivalentes |
| 2 | sem `toLowerCase` em `encontrarZonaPorCaminho` | pega (unidade C1 + e2e L2) |
| 2 | sem `toLowerCase` no prefixo estático | pega só na unidade ("C1: prefixo estatico…") |
| 3 | `lerComLimite` lê tudo antes de medir | pega só por **travamento**: o teste com fluxo infinito nunca termina (matei com timeout de 180 s). Falta `{ timeout }` no teste |
| 3 | sem a checagem do `Content-Length` declarado | equivalente no que dá para observar: medido ao vivo, o shell só responde depois do corpo declarado inteiro, com e sem a checagem (CL 10 MB sem corpo: nenhuma resposta em 4 s nas duas). O early return não adianta a resposta |
| 3 | extra: a rota lê com limite `Infinity` | sobrevive (o 413 vem depois, de `processarLote`); só a unidade da função pura protege o limite em streaming |
| 4 | lote anônimo repassado | pega (L4) |
| 4 | sem checar o 429 | pega (L4). **Repassar e depois devolver 429 sobrevive** (T4b2) |
| 4 | aceita não-JSON | **sobrevive** |
| 5 | limitador sem limpeza | pega (unidade) |
| 6 | CSP sem `form-action` / sem `img-src` | **sobrevivem** as duas |
| 7 | fetch indireto no N8 | 2 de 9 pegos; ver acima |
| 8 | `__Host-flash` sem `Secure` | nenhum teste pega; o código do escopo já está assim |
| 9 | sobreviventes da iteração 1 | ver a seção anterior |

## Comportamento declarado → existe teste que reprova a regressão?
| Declaração | Teste | Pega? |
|---|---|---|
| §1.1 `/login`, `/api/auth`, `/erro-de-zona` públicos | unidade "rotas publicas" | sim |
| §1.1 … "com CSP e nonce" | nenhum em `/login` | **não** (M17) |
| §1.1 `/api/otel` sem sessão: 204, descarta sem ler | e2e L4 (coletor) | sim (T4a, T4a2) |
| §1.1 > 256 KB lidos: 413 | unidade `lerComLimite` + L4 | o status sim; o "sem ler tudo" só na unidade, e só por travamento (L3a, L3c) |
| §1.1 > 60 lotes/min: 429 | L4 | o status sim; **o não repasse do recusado, não** (T4b2) |
| §1.1 repasse pelo registro de destinos | N8 (regex) | parcial; contornável (7 formas) |
| §1.1 prefixo de zona casado sem diferenciar maiúsculas | unidade C1 + L2 | sim no caminho; **não** no id (C1c, até `6d93f8e`) |
| §1.1 sonda: cache 1 s | L2 | sim (M3, M3b, M3c, M3d) |
| §1.1 sonda: timeout 500 ms | nenhum | **não** (M14, M14b) |
| §1.1 fora = erro de rede **ou status ≥ 500** | só erro de rede | **não** (M15) |
| §1.1 503 · Retry-After 5 · página | unidade + L2 | sim (M4b2, M4c, M5b) |
| §1.1 asset estático só depois da sonda | nenhum | **não** (M13) |
| §1.1 sem cookie → 307 `/login?de=` | unidade + camada 1 | sim |
| §1.1 segue com CSP (nonce), x-erp-caminho, flash consumido | "CSP com nonce", L3 | nonce sim; diretivas **não** (CSP6a/b); x-erp-caminho **não** (M20, quase equivalente); forjado apagado sim (M10); cookie apagado **não** (M16, F8) |
| §8 domínio de negócio cai → só o bloco | D5 | sim |
| §8 gestão de acesso cai → sem a página, "ninguém entra em módulo" | L1 (zona 1), D4 | só na zona 1; **zona 2 não** (V1) |
| §8 zona cai → 503 + Retry-After em qualquer caixa; as outras seguem | L2 | sim |
| §8 zona travada segura ~0,6 s | nenhum | **não** (M14) |
| §8 volta em ~1,2 s / A12 "~1,5 s" | L2 aceita até 5 s | sim para "volta" (M3d); o número não é verificado |
| A12 503, página, `/` e `/zona1` seguem | L2 | sim |

## Testes mínimos que fecham as lacunas (rodados na cópia)
`anexos/lacunas2.test.mjs` (e2e, no formato de `base/verificacao`) e `anexos/lacunas-unit.test.mjs` (unidade do shell).
- **G1** (fecha V1): gestão de acesso fora; davi, ana e carla em `/zona2` e `/acesso`; o HTML não pode conter
  `Conferir inventário|Revisar cadastro|Concluir e ir` nem `Zonas registradas|Módulos: restrição`. Pega F1-zona2.
  Basta estender o laço do L1 com `/zona2` e `/acesso`.
- **G2**: em `/` e em `/login`, a CSP tem `form-action 'self'`, `img-src 'self' data:`, `object-src 'none'`,
  `base-uri 'none'`, `frame-ancestors 'none'` e nonce. Pega CSP6a, CSP6b e M17.
- **G3**: `/` com `__Host-flash` válido mostra o toast e devolve `Set-Cookie` com `Max-Age=0` **e `Secure`**. Pega
  M16. No código do escopo reprova; com a correção (F8a) passa.
- **G4**: corpo não-JSON com sessão → 400 e coletor vazio; 61 lotes → 429 e **60** no coletor. Pega T4b2 e T4c.
- **G5**: zona 2 morta; `/zona2-static/...` e `/ZONA2-STATIC/...` → 503. Pega M13.
- **U1–U6** (sem servidor): o TTL expira nos dois sentidos (M3, M3b, M3c, M3d); `{status: 502}` → fora (M15); fetch que
  nunca resolve → fora em menos de 1 s, e `TIMEOUT_PROBE_PADRAO_MS === 500` (M14, M14b); zona fora + asset → `zona-inativa`
  (M13); `/api/stream` sem cookie → login (M18).
- **U7**: id `ZonaA` casado ou recusado na carga. Reprova no escopo.
- Pôr `{ timeout: 5000 }` no teste "lerComLimite: para de ler…", para L3a reprovar em vez de travar.
- N8: cada forma contornada acima vira um caso, e `saude-zonas.ts` vira exceção declarada ou passa pelo registro.

Resultados: sem mutação, lacunas2 dá 4/5 (G3 reprova) e unidade 6/7 (U7 reprova). Cada mutação da lista acima faz o
seu teste reprovar. Ver `anexos/lacunas-resultados.txt`.

## Arrumação
- Portas 3000–3003, 4001–4004 e 4010 livres no fim (`ss -ltn`: só a 4873 escuta). Nenhum `next start` nem `servidor.mjs`
  ficou vivo. O Verdaccio (4873) não foi tocado.
- Não editei nada em `repos/` nem em `base/` reais. Na checagem final, sete submódulos estão limpos. `repos/erp-nucleo`
  tem 6 arquivos modificados e o principal mostra ` m repos/erp-nucleo` e ` M repos/erp-shell` (em `6d93f8e`): é trabalho
  de outra pessoa que entrou durante a auditoria. Fora isso, só esta pasta aparece como não rastreada. Não commitei nada.
- Não instalei pacote nenhum. Só escrevi em `.agents/auditor_shell_2/` e no scratchpad (`aud2/`).
