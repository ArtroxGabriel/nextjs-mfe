# Handoff auditor_d19b_2 (final)

**Veredito: PASS.** Os testes novos pegam as três mutações do veto (A10, A10c, A10d), no núcleo e pelo `dist` instalado no
shell, e todas as variantes plausíveis que testei. A regressão por família não perdeu nada em relação ao piso da iteração 1.
Fica uma observação sem veto (V11, código anterior à D19-B).

Gate D19-B, iteração 2. Pela regra "Veto só por teste", só eu rodei, sem revisor e sem challenger. Principal `b1bacee`,
núcleo `610217d` (0.10.3), shell `0a3131d`, zona-1 `860a176`, zona-2 `5a665a7`, zona-acesso `4ea036d`.

Método: `mut2.py` no scratchpad, que é o executor do auditor_d19b_1 com o registro trocado e `arquivo:linha` acrescentado.
Ele troca um trecho que aparece uma vez só no arquivo, roda a suíte, restaura o arquivo e grava em `mutacoes.txt` o trecho
exato antes e depois, junto com os testes que reprovaram. As mutações no `dist` do shell foram conferidas por sha256
(`815631ad…`, igual antes e depois).

## Etapa 1: a correção só muda `test/`
- No núcleo, `fdea296..610217d` muda só `test/identidade.test.mjs` (+62). No shell, `72ecc2f..0a3131d` muda só
  `test/proxy-renovacao.test.mjs` (+39). No principal, `896c751..b1bacee` muda só os ponteiros dos submódulos.
- O produto é o mesmo da iteração 1. O `src` não mudou. O `dist` do @erp/nucleo nas 4 apps e o `dist` local são iguais ao
  tarball 0.10.3 do Verdaccio (`diff -r`). Linha de base: núcleo 271/271, shell 108/108.

## Etapa 2: o veto e as variantes. 20 mutações, 19 pegas, 1 viva
| Mutação | Onde | Resultado |
|---|---|---|
| V-A10, V-A10c, V-A10d (literais do veto) | `criarNucleo.ts:264`, `:296`, `:306` | pegas, cada uma pelos 3 testes do momento dela (memória, arquivo, Redis) |
| VS-A10, VS-A10c, VS-A10d | `dist` 0.10.3 no shell | pegas, cada uma pelos 2 testes do shell daquele momento |
| V-A10b / VS-A10b (engole o erro e espera até o teto) | núcleo / `dist` no shell | pegas (avaliação abaixo) |
| V01 (catch na espera devolve `revogada`), VS-V01 | espera | pegas |
| V02 (catch na espera devolve `em-andamento` na hora) | espera | pega; o efeito no proxy é o mesmo do produto (ver A10b) |
| V03 (catch que reconsulta depois de um passo e devolve `ausente`) | espera | pega |
| V04 (try/catch em volta do laço inteiro devolve `ausente`) | espera | pega |
| V05, VS-V05 (catch dentro do próprio `valida`, que vale para as 3 leituras) | `criarNucleo.ts:222` | pegas, 9 no núcleo e 6 no shell |
| V06 (`esperarRenovacao(id).catch(() => 'ausente')`) | chamada da espera | pega |
| V07 (catch antes do lock devolve `revogada`) | `:296` | pega |
| V08 (catch com o lock na mão remove a sessão e devolve `revogada`) | `:306` | pega |
| V09 (adaptador Redis do núcleo transforma GET que falha em `null`) | `sessao-redis.ts:85` | pega pelo teste do adaptador ("Redis fora do ar vira erro normalizado"), não pelos testes novos |
| **V11** (shell `lib/redis.ts`: GET que falha vira `null` no invólucro do node-redis) | `erp-shell/lib/redis.ts:15` | **VIVA** nas unidades (108/108) e no ponta a ponta (V11e: `CONSTRUIR=1 task verificar:redis` com o shell reconstruído, 118/118) |

O "catch só em um store" não tem forma natural em `criarNucleo.ts`, que trata os três stores do mesmo jeito. Por isso testei
essa ideia nos adaptadores: V09 no Redis do núcleo (pega) e V11 no invólucro do shell (viva). O adaptador de arquivo já
transforma em `null` qualquer erro de leitura (`catch { return null }` em `sessao-arquivo.ts:26`). Isso já existia antes da
D19-B e só vale em desenvolvimento, então não abri mutação para ele.

**V11 é observação, sem veto.** O código vem de antes da D19-B: foi criado no D1 (`8559367`) e tocado no D2 (`03ba9b0`). Não
está no diff da D19-B nem nas leituras de `renovarSessao` que o veto cobriu, e o adaptador do núcleo, que é a camada que o veto
tratava, está coberto (V09). O sintoma é o mesmo do D19: um tropeço do Redis vira `ausente`, o proxy apaga o cookie e manda ao
login com a sessão intacta. O próprio comentário de `clientePreguicoso` promete o contrário ("nunca 'deslogado' silencioso").
Teste sugerido, de uma linha de produto a menos de risco: em `erp-shell/test/redis.test.mjs`, "GET (e conexão) que falha
rejeita, nunca `null`"; o mesmo para `lib/redis.ts` das três zonas. Se o orquestrador quiser, cabe em `DEFERRED.md`.

## Etapa 3: os dentes dos testes novos
- **Nenhuma asserção passa com o teste vazio.** No núcleo, `estado instanceof Error` e `message` casam com o erro do store, e
  `leituras() >= falharNa` prova que a falha aconteceu no momento pedido. O teste também confere que o IdP não foi chamado
  (`renovacoes === 0`) e que a sessão ficou no store, ainda vencida. No shell, `leituras === falharNa` é exato, `acao` tem de
  ser `prosseguir`, `limparSessao` tem de ser `undefined`, e o teste confere o tempo, o IdP (0 chamadas) e a sessão intacta.
- **A cobertura não fica na forma literal.** As 11 variantes de forma diferente (V01–V08, V-A10b, V05 nas 3 leituras de uma
  vez, VS-*) foram pegas.
- **A asserção de menos de 1 s é segura.** Repeti os testes 5 vezes no núcleo e 3 no shell, e o mais lento levou cerca de
  22 ms. No núcleo o teto é de 300 ms (`ESPERA_CURTA`), então ali a asserção de tempo nunca é a que reprova: quem pega A10b
  é `instanceof Error`. No shell, com o teto padrão de 2000 ms, é ela que pega VS-A10b (2004 ms). Uma ressalva: o
  `leituras === falharNa` exato do shell recusaria também uma implementação legítima que tentasse ler de novo uma vez e
  depois propagasse o erro. É mais estrito que o necessário, mas não faz mal.
- **Nenhum teste pendura a suíte.** Os testes têm `timeout: 10_000`, o leitor que lança é limitado pelo teto da espera, e
  as suítes completas fecharam normalmente (núcleo em cerca de 15 s, shell em cerca de 2 s). O risco de laço vazado depois
  do timeout, visto na A04 da iteração 1, só volta se alguém combinar "sem teto" com "engolir o erro". Não é o caso de
  nenhuma mutação aqui.

**A10b (engole o erro e espera até o teto): pega. A exigência é coerente, um pouco mais estrita que o texto, e não é veto.**
O efeito de A10b no proxy é o que `decisao-proxy.ts` promete ("Erro (IdP ou store fora): a sessão fica e a requisição
segue"): `em-andamento` vira `prosseguir` sem `limparSessao`, só que 2 s depois. O adendo 3 do ADR-0013 aceita esses 2 s só
para o IdP fora (item 3), e o risco residual dele fala do Redis *travado*, não de erro. Para o store, os documentos não dizem
nada. Exigir que o erro se propague logo combina com o resto do desenho: na decisão 1 o erro transitório **lança**, o
`semVazar` diz que Redis inacessível "é falha de infraestrutura, não sessão ausente", e o catch do proxy existe para isso.
Esperar o teto com o store fora não traz benefício, porque ninguém consegue gravar o token novo. O único caminho que o
teste fecha é "tentar ler de novo durante a espera até o store voltar". Isso seria uma escolha de desenho, e hoje não há
documento que o peça. Sugestão (opcional): uma frase em `decisao-proxy.ts` ou no adendo 3 dizendo que erro do store na
espera propaga sem esperar o teto, para o teste não fixar um contrato que não está escrito.

## Etapa 4: regressão por família, com o piso da iteração 1. 13 mutações, 13 pegas
Pegas: A01, A04b, B01, B11, C03, D14, A10e, Z01 (P12), R05, R11, S01 (F04), S02 e E01. **B11, que estava viva na iteração 1,
agora é pega** ("padrao, teto e recusa na criacao"). **E01** (renovarSessao da 0.10.2 no `dist` do shell): `CONSTRUIR=1 task
verificar:oidc` reprova o teste das 10 concorrentes com `status do lote: 200 200 307 200 307 200 307 200 307 200`.

## Contagem
34 registros em `mutacoes.txt`: **32 pegas e 2 vivas** (V11 e V11e, que são a mesma mutação em duas suítes, como
observação), **0 equivalentes vivas**. Por etapa: na 2, 20 mutações, 19 pegas e 1 viva, mais V11e; na 4, 13 de 13 pegas.
Pegas mas equivalentes no efeito: V-A10b, VS-A10b e V02. O teste é mais estrito que o contrato do proxy (avaliação acima).

## Estado ao fim (conferido)
- As fontes estão nos HEADs, com `git status` limpo em todos os submódulos, exceto os `pnpm-lock.yaml` de erp-dominio-stub e
  erp-moldura, que já estavam assim e não foram tocados. Nada foi criado em `src/`.
- O `dist` do @erp/nucleo nas 4 apps é igual ao tarball 0.10.3 (`diff -r`). O `repos/erp-nucleo/dist` foi reconstruído do
  fonte limpo e também é igual. O sha256 do `criarNucleo.js` do shell bate.
- O shell foi reconstruído limpo (BUILD_ID 15:16, depois de restaurar V11 e o `dist`). As builds das zonas não foram
  mutadas.
- Suítes: núcleo `pnpm test` 271/271; shell `pnpm test` 108/108; `task test` rc=0 (271, 108, 75, 26, 20, sem falha);
  `CONSTRUIR=1 task verificar:redis` 118/118; `CONSTRUIR=1 task verificar:oidc` 6/6; `task showcase:checar` rc=0 (a vida
  do token voltou ao padrão).
- As portas 3000–3003 e 4001–4120 estão livres e não há processo `next` vivo. Redis (6379) e Keycloak (8080) estão no ar.
- `grep -rlE 'eyJ[A-Za-z0-9_-]{10,}\.eyJ'` nesta pasta não acha nada. Não fiz commit, push, publicação nem instalação.
- Arquivos: `handoff.md` e `mutacoes.txt`. Os logs brutos de cada mutação ficaram no scratchpad (`a2/logs/`), fora do
  repositório.
