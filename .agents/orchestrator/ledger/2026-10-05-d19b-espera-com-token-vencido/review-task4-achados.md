# Revisão Task 4 D19-B (final)

Veredito: APROVADA. Nenhum Critical nem Important. Rodado: `task scripts:test` 25/25, `task verificar:estatica` 51/51,
`task typecheck` ok, `erp-shell pnpm test` verde. Ponta a ponta e mutações não rodados (sem portas, só leitura): conferi a lógica.

## Minor
1. `docs/CONFIGURACAO.md` (linha de `ERP_RENOVACAO_ESPERA_MS`): "o padrão de 2000 exige `ERP_RENOVACAO_LOCK_S` >= 3" é
   verdade para a regra espera < lock, mas lock 3 s só passa com `ERP_DESTINO_TIMEOUT_MS` < 1500 (lock > 2 x timeout; com o
   padrão de 5000 o lock mínimo é 11). Acrescentar "e, com o timeout padrão, >= 11".
2. `docs/adr/0013-*.md` adendo 3, verificação: diz "teto mais dois passos" e o item 2 diz "no máximo um passo"; o código
   (`criarNucleo.ts` `esperarRenovacao`) é um passo mais a leitura. Dizer que dois passos é a margem do teste.
3. `docs/CONFIGURACAO.md` linha de `ERP_RENOVACAO_JANELA_S` não cita o log padrão do núcleo sem registrador
   (`[renovacao] …`), só o do shell (`[auth] renovacao: …`, confere com `rotas-auth.ts:57`). Opcional.
4. P12 (`base.test.mjs:562`) confere a ligação por regex e a função pelo import real: reverter `pagina.ts`, `next.config.ts`
   ou tirar o `trim` do helper reprova (por leitura, não rodei a mutação). Não compara o helper entre as 3 zonas
   (hoje o hash do arquivo é igual nas três). Opcional.

## Conferido
- Código: `lerHostsDoShell` igual nas 3 zonas (blob fb0776b), usado em `lib/pagina.ts` e `next.config.ts`; sem `server-only`
  está certo (puro e importado pelo `next.config`). Guarda do e2e agora soma `TOLERANCIA_S`. `ERP_RENOVACAO_ESPERA_MS=4000`
  < lock 5 s (`criarNucleo.ts:199`) e > timeout 2 s; o comentário cita o efeito no JWKS. Teste de `lib/nucleo.ts` pela árvore
  do TypeScript: importa de `./rotas-auth` e exige a propriedade só no objeto de `criarNucleoDoShell`; comentário não conta.
  `estado-do-showcase.mjs` e o aviso em `subir.mjs` (início e fim do banner); `showcase:dados:resetar` existe no Taskfile.
- Documentos contra o código: faixas de espera (0..300000, `< lock`) e passo (10..300000, só comparado com espera > 0) batem
  com `criarNucleo.ts:198-205`; `ERP_LOGIN_TRANSACAO_S` não lido pelo shell (`iniciarLogin` devolve `expiraEm`); §2 do timeout
  bate com `lerTimeoutDeDestinoMs` na criação; `SHELL_HOSTS` bate com `erp-shell/lib/configuracao.ts` e as zonas;
  `X-Forwarded-Proto` bate com a análise da Task 3; §5 (validação na primeira requisição) e `AMBIENTE.md` §3 coerentes com
  o relatório (teste real de `abc` registrado); ROTEIRO e README sem contagem (grep: nenhum número de testes sobrando);
  decisão 4 remete ao adendo 3; custo com o IdP fora e "janela sem espera" batem com `renovarSessao`.
- Pendências: todas as das Tasks 1 a 3 que foram para a 4 estão feitas (I1 SHELL_HOSTS, guarda do e2e, 4000, regex frágil,
  X-Forwarded-Proto, M5, M7, M8, M9, menor 6 e 7 da Task 1 -> D24).
- `DEFERRED.md`: D19 e D20 saíram com evidência e commits no cabeçalho; D24 com motivo e gatilho (`lib/redis.ts` existe
  nas 4 apps; P1 existe no arquivo).
- AGENTS.md: sem violação. Nenhum fetch novo, sem `NEXT_PUBLIC_*`, sem sessão fora do shell, configuração documentada no mesmo commit.
