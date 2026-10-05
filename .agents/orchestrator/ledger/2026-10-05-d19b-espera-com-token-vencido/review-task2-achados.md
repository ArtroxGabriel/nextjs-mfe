# Revisão Task 2 D19-B — achados (final)

Base: núcleo c879b0b..e1a09f2 (local), principal 264352f. `cd repos/erp-nucleo && pnpm test`: 258/258 (rodado na revisão).

## Veredito

APROVADO COM 1 IMPORTANT (barato, pode ir na Task 3 antes de publicar o 0.10.3). Nenhum Critical.

## Conferido

1. Lock × timeout: `criarNucleo.ts:188-191` recusa `lockMs <= 2*timeoutMs`, lendo `lerTimeoutDeDestinoMs()`, o mesmo
   leitor do `identidadeOidc` (`identidade-oidc.ts:98`). Padrões 15 s/5 s passam; fronteira (10 s, 3/1500) recusada e
   testada. `verificar:oidc` com `ERP_DESTINO_TIMEOUT_MS=2000`: a variável chega ao shell (`ambienteDoPapel('shell')`
   repassa tudo) e também a zonas e stub (allowlist); nenhum teste OIDC mede timeout, lock e janela seguem 5 s: não
   enfraquece o que a verificação prova (risco só de oscilação com Keycloak frio, Minor).
2. Janela × vida: `tokenVidaMs` é número não sensível; `atual()` projeta `{ sub, nome }` (`criarNucleo.ts:138-142`);
   `ehSessao` do Redis só confere obrigatórios, sessão antiga sem o campo cai em `janelaMs` (`janelaDe`). Registro só
   `{ codigo, supportId }`, uma vez por sessão (`!violaJanela(anterior)`); janela efetiva `min(janela, vida/2)` impede o
   laço (token novo nasce com vida > vida/2); token cortado (`tokenExpiraEm === expiraEm`, via `Math.min` nos dois
   adaptadores) não mede. `registrarFalha` opcional com console padrão espelha `DependenciasDeAutenticacao.registrarFalha`
   do shell (`rotas-auth.ts:18,49`); o núcleo não tem equivalente.
3. `urlRetorno`: `validarUrl(..., true)`, teste com `?x=1` e `#x` e mensagem.
4. `expiraEm`: aditivo; é o `transacao.expiraEm` que o store usa como TTL; testado (igual ao gravado; 600 s/90 s).
5. Menores da Task 1: feitos (recusas '1e3','0x10','+5'; mensagem acima do inteiro seguro + teste; comentário do `sub`;
   vencedor revogada → perdedor ausente nos três stores).
6. Mutações: as 7 do relatório são coerentes com os testes lidos.
7. Invariantes 1, 3, 12, 15: ok (server-only nos módulos tocados; escrita só em `criarNucleoDoShell`).

## Important

- I1. `FalhaDoNucleo` não diz qual falha foi (`criarNucleo.ts:32`). Só o console padrão nomeia a causa
  (`criarNucleo.ts:205`). Com `registrarFalha` injetado (o que a Task 3 planeja, unificando com `registrarNoConsole`, que
  imprime `f.etapa`), o log vira `codigo=ERRO_INTERNO supportId=…` sem causa, e o `supportId` não liga a nada. Correção:
  `FalhaDoNucleo = { motivo: 'janela-de-renovacao'; codigo; supportId }` (literal fechado, sem dado sensível), console
  padrão e teste afirmando o `motivo`; o teste das chaves exatas passa a `['codigo','motivo','supportId']`.

## Minor

- M1. `registrarFalha` que lança derruba `concluirLogin`/`renovarSessao` depois do IdP (`criarNucleo.ts:234`): envolver em try/catch.
- M2. Sem teste para a fronteira do registro entre vida/2 e vida (mutante `janelaMs*2>=vida` → `janelaMs>=vida` passa): caso janela 40 s, vida 60 s.
- M3. Sem teste para o descarte do `tokenVidaMs` antigo quando o token novo vem cortado (mutante que não remove `tokenVidaMs` de `s` passa).
- M4. Sem teste explícito de sessão antiga sem `tokenVidaMs` (janela configurada; registra na primeira renovação).
- M5. "Uma vez por sessão" é aproximado: renovação com token cortado apaga o campo e a seguinte registra de novo; shell 0.10.2 em deploy gradual também. Documentar.
- M6. `urlRetorno` com `?` ou `#` vazio no fim passa (`url.search`/`hash` vazios; `identidade-oidc.ts:39`); comparar `href` com origem+caminho.
- M7. `CONFIGURACAO.md:101`: linha com 5 células numa tabela de 4 colunas, e "Padrão 2000" é valor da tarefa, não padrão.
- M8. `CONFIGURACAO.md:45` (§2, `ERP_DESTINO_TIMEOUT_MS`) não cita `criarNucleoDoShell` nem a regra do lock (Task 4).
- M9. Timeout de 2 s em `verificar:oidc` vale também para zonas e stub (JWKS): pode oscilar com Keycloak frio; dizer no comentário do Taskfile.
