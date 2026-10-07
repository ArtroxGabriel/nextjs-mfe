# Handoff revisor_c1_1 (final)

Veredito: APROVA. Nenhum Critico nem Importante.

## Menores (nenhum bloqueia o gate)
1. repos/erp-shell/lib/decisao-proxy.ts:48-53 (ehFragmento): decodifica uma vez e nao colapsa `//`. Suspeita da Task 2 verificada contra o
   regex real de rotas do zona 2 (getRouteRegex do Next, e .next/routes-manifest.json: `^/zona2/_fragmento/tarefas/...`): `/zona2//_fragmento/..`
   e `/zona2/%255Ffragmento/..` NAO casam a rota; `/zona2%2F_fragmento` nem e reconhecido como zona pelo rewrite. Sem alcance demonstravel.
   Endurecimento opcional: colapsar `/+` e decodificar ate estabilizar. Nao pude rodar contra a base (portas reservadas): o challenger confirma.
2. repos/erp-nucleo/src/fabricas/fragmento.ts:21 (ATIVO, anterior ao C1): `<img/onerror=` e `<svg/onload=` passam (so `\son..=` com espaco);
   entidades em `javascript:` tambem. Mitigacao real hoje: zona 2 escapa titulos (`escapar`) e a CSP da zona 1 (`script-src nonce strict-dynamic`,
   borda/csp.ts:39) bloqueia handler inline. Defesa em profundidade: trocar `\s` por `[\s/]` antes de `on`.
3. repos/erp-zona-1/app/zona1/page.tsx:17: busca o fragmento tambem de quem nao tem o modulo da zona 2 (um 204 inutil por render). Sem vazamento.
4. repos/erp-zona-1/lib/fragmentos.ts:12: ZONA2_URL invalida derruba a pagina no carregamento (fail-fast) em vez de esconder o bloco. Documentar.
5. base.test.mjs C1a/C1c: nao conferem titulo real de tarefa nem escape (`<`, `&`); regressao "lista sempre vazia" passaria. C1c nao olha token no HTML/RSC.
6. ADR-0011 adendo cita alvo.md §6 (fora do commit); atual.md sem a aresta zona1->zona2 (ja registrados).

## Conferido sem achado
- Zona 2 route: `exigirModulo('zona2','tarefas.ver')` primeiro, negado/forjado = 204 sem corpo (inv. 8, 16); `server-only` no lib; HTML escapado, sem script.
- Zona 1: sem fetch proprio (usa criarFragmento); N8 varrerAplicacoes() = [] sem excecao nova; cookie repassado como veio, sem identidade afirmada;
  origem direta da zona 2, nao passa pelo shell; prop nao vai a ilha `use client` (HTML string em div server).
- Shell: guarda antes da sonda e do cookie, 404 sem corpo e no-store; 11/11 em test/proxy.test.mjs; so `_fragmento` logo apos o prefixo da zona.
- Config: ZONA2_URL com padrao, em AMBIENTE_PERMITIDO.zona e em CONFIGURACAO.md no mesmo commit; dependencia de camadas intacta (nucleo sem mudanca).
- C1a-C1d provam o que dizem (200/204/307/404, versao, sec-fetch-dest, bloco so com dois modulos, timeout, volta sozinho), salvo menor 5.
- Nao rodei C1a-C1d (exigem a base e as portas reservadas).
