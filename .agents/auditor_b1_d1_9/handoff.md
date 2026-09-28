# auditor_b1_d1_9 — handoff (parcial)

Gate B1+D1+G3+K, iteração 9. Auditor forense com veto (Opus). 2026-09-28. Critério: Decisão A2.
Escopo: K5 (`d9ff04e`), `c4b94e6` (showcase, completude) e `erp-nucleo` `08642ed` (fronteira).

## Estado
- Estado inicial em `anexos/estado-inicial.txt`: submódulos nos HEADs; só `pnpm-lock.yaml` de stub e moldura
  modificados (hash local, intocados); `dist` do núcleo nas 4 apps = tarball 0.9.2 do Verdaccio (`9ff2f87f…`,
  `diff -r` vazio); portas livres. Base limpa: `CONSTRUIR=1 task verificar:redis` **109/109** (`anexos/e2e-base-redis.log`).
- Executor: `anexos/mut.mjs` + `lote.mjs` (os da it.8; cópia transitória dos dados do stub no scratchpad, fora do git).
  Lotes gerados por `anexos/gerar-lotes.mjs` (`U.json`, `U2.json`, `S.json`, `E.json`).
- **Feito:** lote U (unidades: núcleo, stub, shell, scripts; 56 + 4), lote S (estático; 59), contornos da it.4/it.3/it.8
  nos dois modos (com e sem programa TS) e contornos novos (`anexos/contornos-it9.mjs`).
- **Em andamento:** lote E (ponta a ponta, `task verificar:redis`), depois modo arquivo, prova da senha, estado final.

## Resultados até aqui
- **Catálogo da it.8:** tudo o que era veto agora é pego: N38g, N38h, N38i, N38k, N38l (fronteira, 142 → falha), SR3, XR20q/XR20r
  (estático 47/48), XR20c–i (contornos). Lacunas: L1 (TA1, TA4, TA5, TA9) pegas; L2 (SR6) pega, SR1 agora falha para o lado
  seguro (SK3); L3 (XN09a/b) pegas; L4 (FR2, reaplicado como FR2b) pega. Nenhuma regressão nos contornos da it.4/it.3.
  S17c (L5) segue sobrevivendo (fora do pedido). SR7 equivalente.
- **Mutações novas que sobrevivem (classificação provisória):**
  - FK3/FK4 (regra por tipo sem o ramo de união / de `Promise`): 142/142. Os ramos pegam hoje N38q (fábrica assíncrona
    `Promise<StoreDeSessao>` na raiz) e N38r (retorno `LeitorDeSessao | StoreDeSessao`), mas sem eles N38q/N38r passam
    142/142: código sem teste → lacuna (mesma classe do TA1 da it.8).
  - FK2, FK11, FK12: equivalentes hoje (nenhum rename em `shell/index.ts`; a regra por tipo cobre).
  - N38p (`export *` em `/shell` de função que recebe o store): passa; inofensivo (a zona não tem store para passar).
  - NR1/NR2 (suspeita do revisor): passam na fronteira; NR3 (`import 'redis'` literal) não compila (núcleo sem a dependência).
  - AK6u/AK7u/AK8u (build/registrar com ambiente inteiro): passam nas unidades; ponta a ponta no lote E.
  - SK8 (`valorConstante` aceita `let`): o caso `let` do teste é pego por outra regra (o literal `'fetch'`) → lacuna.
  - SK3, SK12–SK15: falham para o lado seguro (falso positivo) ou não compilam: equivalentes.
- **Contornos novos:** `declare const/let/function/class fetch|WebSocket` esconde a global (XR20k2–k5, XR20l, XR20m); `require` por
  apelido / `__non_webpack_require__` / `module.require` (XR40–44); rede do navegador sem `fetch` (XR45–48; CSP `default-src 'self'`);
  `assetPrefix` por `??=`, `||=`, `+=`, `defineProperty` (XN09h/i/j/n).
