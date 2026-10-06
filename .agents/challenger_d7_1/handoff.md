# Handoff challenger_d7_1 (final)

Veredito: APROVA (nenhuma divergencia entre o declarado e o observado).

Etapas (todas feitas):
- 1 ambiente: Redis, Keycloak, Verdaccio no ar; portas 3000-3003 e 4001-4120 livres antes.
- 2 teto padrao: zona-2 congelada (SIGSTOP), 3 repeticoes: 500 "Internal Server Error" em 10016/10010/10009 ms; apos SIGCONT volta 200 (out-t2-teto-padrao.txt).
- 3 ERP_ZONA_TETO_MS=6000: 500 em 6015/6010/6012 ms (out-t3-teto-6000.txt). Invalidos (0, 5000, abc, 120001, 8000 com DESTINO=8000, 7000/7000) recusados com "configuracao invalida:" ao carregar next.config.ts, processo nao abre porta (http=000). Validos 120000 e 7000/6000 sobem (200) (out-t3-invalidos.txt).
- 4 streaming (zona falsa em 3002 + shell real, teto 6000; zona-falsa.mjs, streaming.mjs): resposta de 10 s com pedaco a cada 2 s NAO cortada (completa em 10025 ms); silencio de 4 s (< teto) ok; cabecalho + 1 pedaco e depois silencio: cliente recebe 200 + "inicio", e aos 6021 ms a conexao e abortada (UND_ERR_SOCKET, "terminated"), sem fim limpo; silencio total: 500 aos 6023 ms (out-t4-*.txt).
  Observacao (nao divergencia): com Accept-Encoding gzip o shell comprime e entrega tudo de uma vez ao fim (49 B em 10027 ms); com identity os pedacos chegam incrementais a cada 2 s. Relevante para SSE de zona.
- 5 efeitos: com zona-2 congelada, /login, /, /erro-de-zona e /zona1 respondem 200 em 19-203 ms; zona-2 morta (SIGKILL): 503 + Retry-After 5 em 7-16 ms, volta 200 apos reiniciar; dominio-b congelado: /zona1 200 degradado em ~2040 ms; dominio-c congelado: /zona2 500 em ~2045 ms (pagina de erro generica do Next, __next_error__, sem supportId) (out-t5*.txt).
  Observacao: a espera e 2 s porque as zonas declaram timeoutMs: 2000 por destino (repos/erp-zona-*/lib/nucleo.ts), nao ERP_DESTINO_TIMEOUT_MS; com DESTINO=7000 e FRAGMENTO=9000 continua 2 s. Nao executei espera de 5-10 s de dominio sem alterar codigo de zona.
- 6 regressao: task verificar = 119 testes, 115 pass, 0 fail, 4 skipped; task verificar:redis = 119/119 pass, 0 skipped. L9 passou nos dois (6090 e 6120 ms).
- 7 derrubei so o que subi; portas liberadas.

Nenhum token/cookie nas saidas (grep conferido).
