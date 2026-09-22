# auditor_b1_d1_2 — handoff (parcial)

Gate B1+D1, iteração 2. Auditor forense com veto. Início: 2026-09-22.
Log bruto de cada mutação: `anexos/lote.log`. Uma linha por mutação: `mutacoes.txt`.

## Estado inicial conferido
- Submódulos: só `pnpm-lock.yaml` modificado (integrity do Verdaccio local) em dominio-stub, moldura, nucleo, shell, zona-1, zona-2, zona-acesso. contratos limpo (o orquestrador commitou b56320e em erp-contratos durante a auditoria; fora do escopo, avisado).
- `@erp/nucleo` 0.8.2 instalado nas 4 apps; o `dist` instalado é hardlink compartilhado (5 links: 4 apps + store do pnpm). Mutação ali é escrita no mesmo inode e restaurada do backup.

## Progresso
- [x] leitura do escopo
- [x] núcleo, unidade (N01–N39): mutação no `src`, `pnpm test` (tsc + fronteira + node --test)
- [x] sonda do fallback v2 (script temporário no `test/` do núcleo, apagado)
- [x] moldura, unidade (M01–M07, todas pegas)
- [x] shell, unidade (S01–S10)
- [x] contornos do seguranca-estatica e saida-de-rede (anexos/contornos-estatica.log): 28 de 29 passam
- [x] Redis caindo depois de conectado (anexos/redis-queda.log): 1ª chamada erra em 2 ms, as seguintes esperam 5 s (connectTimeout padrão do node-redis) e viram ERRO_INTERNO
- [x] ponta a ponta lote 1 (E01–E11, fontes das apps)
- [ ] ponta a ponta lote 2 (dist instalado, CONSTRUIR=tudo)
- [ ] restauração e verificação final

## Achados até agora (a confirmar no fim)
- N08: `// sem import 'server-only' aqui` satisfaz a fronteira (checagem por `includes` do texto).
- N17: `exigirModulo(id, funcionalidade)` de `@erp/nucleo/app` sem checar a funcionalidade passa (nenhum teste de funcionalidade na página).
- N27 + sonda: `/v2/eu` respondendo 403, 401, 500, timeout ou sem `modulos` cai no `/v1` e **concede** o que o v1 disser. Nenhum teste cobre o fallback.
- N37: `cache: 'no-store'` → `'force-cache'` passa na unidade do núcleo.
- N38: `@erp/nucleo/app` exportando `criarNucleoDoShell` passa (o teste do invariante 15 só olha a raiz).
- N33/N34/N36: `lerNumeroPositivo` do núcleo e o padrão do timeout sem teste.
- Testes do `acesso.test.mjs` travam (servidor sem `finally { s.close() }`) quando reprovam: N13, N26, N28–N30b só terminaram por timeout.
- E01: zona 1 com `clienteRedis.set/del` direto em `erp:sessao:*` passa 60/60 (o N3 estático só procura `@erp/nucleo/shell`); o Redis é um só, sem ACL, e o cliente das zonas tem set/del.
- E02: `lib/redis.ts` da zona sem `import 'server-only'` passa 60/60 (nenhuma checagem de server-only nos módulos das apps).
- E05: health da zona chamando o domínio A e devolvendo recursos e a origem interna passa 60/60.
- E07: tirar `/v2/eu` do registro da zona passa 60/60 — o ponta a ponta nunca exercita o v2 (o stub em 4010 não serve `/v2/eu`; todo pedido paga um 404 e cai no v1).
- E10: recurso inteiro por spread na ilha `'use client'` passa 60/60 e o estático não vê spread.
