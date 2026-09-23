# auditor_b1_d1_3 — handoff (parcial)

Gate B1+D1+G3+K, iteração 3. Auditor forense com veto. 2026-09-22.

## Estado inicial (conferido)
- Submódulos: contratos b56320e, stub 064dccf, moldura a875c21, núcleo 969b1b0, shell 46237f7,
  zona-1 39a38fd, zona-2 f18b72f, zona-acesso fdabd61. Só os lockfiles de stub e moldura modificados
  (cópias em scratchpad).
- `dist` instalado do núcleo 0.9.2: mesmo inode nas 4 apps; hash da árvore `4f81c920…` = tarball do Verdaccio.
- Dados do stub copiados antes de qualquer mutação.

## Progresso
- [x] leitura do código novo (núcleo, moldura, apps, shell, stub v2, base/verificacao, ambiente.mjs)
- [~] mutações de unidade (lote 1 núcleo: 44; lote 2 moldura/shell/stub: 23) — ver mutacoes.txt
- [ ] mutações repetidas da iteração 2 nas apps (ponta a ponta)
- [ ] mutações novas
- [ ] contornos dos analisadores
- [ ] estado final
