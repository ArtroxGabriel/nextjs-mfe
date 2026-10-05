# Re-revisão Task 6 R1 (final)

Veredito: aprovado, com 2 menores novos (R1, R2). Nada rodado (só leitura).

- I1 ok pela lógica: (a) janela conferida antes do lote (`resta` entre 0 e a janela); (b) conta só `"set" "<chave da sessão>"`
  (chave de lock e de transação são outras; nada mais regrava a sessão no lote: `gravar` só no login, `regravar` só em `renovarSessao`);
  (c) refresh token novo e `tokenExpiraEm` adiante conferidos; 20 respostas via `painelComDominios`.
  MONITOR confirma com `+OK` antes do lote (sem corrida). Espera limitada (~17 s; negativa vira 0; teste tem timeout 180 s).
- R1 (menor) oidc.test.mjs:~220: a mutação "só renova vencido" só reprova se o lote acabar antes do token vencer (~JANELA/2 = 2,5 s);
  se passar disso o token vence no meio e uma renovação ocorre. Correção: depois do `Promise.all`, `assert.ok(Date.now() < antes.tokenExpiraEm, 'lote passou do vencimento')`.
- R2 (menor) apoio.mjs `monitorarRedis`/teste: sem try/finally. MONITOR recusado (-ERR) deixa o socket aberto, e falha entre o
  `monitorarRedis` e `parar()` (ex.: assert do lote) deixa a conexão pendurada e o processo do teste sem sair. Correção: destruir `c` no
  caminho de recusa e envolver lote/`parar()` em try/finally.
- M1 ok: exceção do adendo 2 em CONFIGURACAO.md:21, :24, :61 e ADR-0013 decisão 5 (:32), coerente com o adendo (:143, só loopback, valor exato 1).
- M2 ok: único `describe` pula por `motivoParaPular`; com EXIGIR=1 um teste extra falha com o motivo (cobre todos os 4 motivos). Documentada em CONFIGURACAO.md §6 (:99). Taskfile define.
- M3 ok: `DOMINIO_A` de `PORTAS_DE_DOMINIO['dominio-a']` (4001).
- redisCru: corpo idêntico, só movido e importado; base.test.mjs inalterado em comportamento.
- Textos (ADR-0013 :79-85, 11-testes §3.2, PENDENCIAS §4, atual.md): batem com o teste. Só o "reprova se o proxy só renovar token vencido" depende de R1 (leve exagero).
- AGENTS.md: sem quebra (teste e docs; config documentada no mesmo commit, inv. 15 não afetado).
