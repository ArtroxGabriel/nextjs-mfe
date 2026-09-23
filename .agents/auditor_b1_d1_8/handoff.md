# auditor_b1_d1_8 — handoff (parcial)

Gate B1+D1+G3+K3/K4, iteração 8. Auditor forense com veto (Opus). 2026-09-23. Critério: Decisão A2.

## Estado
- [x] leitura dos documentos (AGENTS, LEIA-PRIMEIRO, AMBIENTE, RETOMADA, GATE_STATUS 4–8, DEFERRED D14, auditor_b1_d1_4, reviewer/challenger_b1_d1_8)
- [x] estado inicial conferido: submódulos nos HEADs do principal, só os 2 pnpm-lock (stub, moldura) modificados (cópias em scratchpad); `dist` do núcleo nas 4 apps = tarball 0.9.2 do Verdaccio (`9ff2f87f…`, anexos/estado-inicial.txt); portas livres; Redis: 267 chaves `erp:sessao:*`, todas com TTL
- [x] lote A1 (unidades: núcleo, stub, shell, scripts) e A2 (contornos da it.4 contra os analisadores, com e sem programa TS)
- [x] lote B (estático no produto + mutações do analisador K3/K4)
- [ ] lote B: catálogo da iteração 4 — ponta a ponta
- [ ] lote C: mutações novas K3/K4
- [ ] estado final conferido

Registro por mutação: `mutacoes.txt` (à medida que roda). Logs: `anexos/`.

## Achados até aqui (parcial)
- N38g/h/i/k/l (inv. 15) sobrevivem ao núcleo 136/136: a fronteira é lista fixa de nomes (`SIMBOLOS_EXCLUSIVOS_DO_SHELL`) e isenta o arquivo definidor inteiro.
- XR20q/XR20r (inv. 4): `constructor(fetch)`, `catch (fetch)`, `for (const fetch of …)`, `set x(fetch)` declaram no escopo de fora; o `fetch` global do arquivo some do N8 (estático 40/40). Prova no ar pendente.
- SR3: reverter o K3 de `fontesDaApp` (pular `test/` em qualquer nível) não reprova nada (40/40): a correção do XR38p não tem teste.
- TA1/TA4/TA5/TA9, SR1, SR6, SR7, FR2, XN09a/b, S17c: lacunas de teste do verificador (detalhe em mutacoes.txt).
- Tipos na ilha (T1–T8: objeto opcional, união, array de string, genérico, any implícito, `{}`, cast, elemento): todos pegos.
- **Veto confirmado (K4ENV1):** `envDaApp` apaga só `REDIS_URL`; com `ERP_REDIS_SENHA_SHELL` definida, a senha de escrita chega às 3 zonas; a zona 1 gravou sessão forjada da carla e o cookie abriu `/`, `/acesso`, `/zona1` (anexos/prova-senha-shell.log); `ERP_REDIS_SENHA_SHELL=… task verificar:redis` 100/100.
- **Veto confirmado (E01g):** o `pnpm build` das zonas roda com `REDIS_URL` (ambiente.mjs:172); gravação no carregamento do módulo durante o build: 100/100 e o cookie forjado abriu `/`, `/acesso`, `/zona1` (anexos/lote/E01g.log). Chaves apagadas.
- Lote C (ponta a ponta do catálogo e K4) em andamento.
