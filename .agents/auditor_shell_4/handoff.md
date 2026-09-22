# auditor_shell_4: gate "Shell novo", iteração 4

**Veredito: CLEAN** (nenhuma mutação do código auditado sobrevive na classe dos vetos anteriores; lacunas abaixo)

Escopo: `erp-shell` 72e0475, `erp-zona-1` f26fd7c, `erp-zona-2` 8627c02, `erp-zona-acesso` ee623ab, `@erp/nucleo` 0.6.0
instalado e fonte do `erp-nucleo` e579454; `base/verificacao/*` e `base/scripts/ambiente.mjs` do principal em 88c9f76.
Tudo rodou numa cópia (`scratchpad/aud4/copia`); a árvore real não foi editada. Tabela: `mutacoes.txt`. Scripts, testes
mínimos e saídas brutas: `anexos/` (`muts.mjs`, `mut.sh`, `mutL.sh`, `lote.sh`, `liberar.sh`, `np.sh`, `np-cadeia.sh`,
`l1-estatico.test.mjs`, `lacunas4.test.mjs`, `congela-e-morre.mjs`, `csp-zona.mjs`, `lote.log`, `*-resultados.txt`, `saidas/`).

## Números reproduzidos
- e2e `node --test base/verificacao/*.test.mjs` na cópia: **50/50, 0 skipped** (CONSTRUIR=tudo, 57 s) e de novo **50/50** no
  fim (CONSTRUIR=1), depois de restaurar tudo.
- Unidade do shell 36/36; unidade do núcleo (e579454) 107/107.
- Catálogo: 61 mutações (55 com unidade do shell + e2e; 6 no fonte do núcleo), 16 páginas novas contra os testes
  estáticos, 1 página nova de ponta a ponta, 1 interrupção do L7.

## V1 e V2 da iteração 3: fechados
- **V1** `F1-recurso-b` (fail-open só em `/zona1/recursos/[id]`): e2e 49/50, reprova **L1/V1**
  ("davi /zona1/recursos/r-1: conteudo do modulo chegou com a gestao de acesso fora").
- **V2** `S-sem-timeout-instancia` (`criarCacheSaudeZona(TTL, 600_000)`): e2e 49/50, reprova **L7**
  ("status sem resposta (TimeoutError) em 5002 ms"). `S-sem-timeout-const` e `S-sem-signal` agora reprovam L7 também.
- Nonce fixo no shell: reprova **L8**.
- Trace forjado (`D-T1-zerado-aceito`, `D-T1-qualquer-texto`): e2e 50/50, pegos só na unidade do núcleo, como na iteração 3.
- O resto do catálogo da iteração 3 deu o mesmo resultado (as equivalências F1-acesso, F1-shell, D-F8-zonas-sem-secure e
  T1-shell-repassa-cru seguem 50/50).

## Ataque aos testes novos
**Completude do L1.** Reprova página literal, grupo de rota (`zona1/(grupo)/novo`, `(interno)/zona2/extra`), `zona2/[id]`,
`recursos/[id]/editar`, `[[...r]]` e `@modal`. **Não reprova:**
- `zona1/[secao]` e `zona1/[...resto]`: o padrão `^/zona1/[^/]+$` casa com a entrada `/zona1/relatorios`, que o Next serve
  pela página estática. Prova de ponta a ponta (`np-cadeia.sh`): página `zona1/[secao]` com o **mesmo fail-open do V1**,
  lendo o domínio A → e2e **50/50**, e com a gestão de acesso fora `/zona1/secao-qualquer` entrega o conteúdo com status 200
  (G11; dentes: com a gestão no ar davi vê a seção).
- Página em `(publico)` dentro de uma zona, e `page.ts/.jsx/.js`: puladas pelo L1 **e** pelo "invariante 16 estatico", até
  sem `exigirModulo` (esse buraco do inv16 estático já existia).
- Página nova no shell: o shell fica fora de propósito, com base numa propriedade da página atual (`/`), não de uma futura.

**L7.** Depende do TTL de 1 s (espera fixa de 1200 ms) e tem folga de 1,5 s no limite de 2 s; se o TTL subir, o teste
reprova (fail-safe: `S-ttl-5s-instancia` reprova L2 e L7). Numa falha comum o `finally` descongela: depois do L7 reprovado
por V2, G5 (zona 2) passou. **Mas** se a verificação morre durante o L7 (Ctrl-C, timeout, kill), a zona 2 fica em estado T:
SIGTERM não a derruba, a checagem de porta do `subir()` (fetch de 500 ms) a dá como livre, e a execução seguinte trava 304 s
e reprova 39/39 com "nao respondeu a tempo: http://localhost:3002/zona2". Falha fechada com mensagem enganosa.

**L8.** Só olha `/` e `/login` (caminho do shell) e só exige nonces diferentes. Sobrevivem: nonce por contador ou relógio
(`CSP-nonce-contador`, `CSP-nonce-relogio`) e **nonce fixo no `criarProxy` do núcleo**, que é o nonce de toda página de zona
(`D-CSP-nonce-fixo-zonas`: shell 36/36, e2e 50/50; `N-CSP-nonce-fixo-zonas`: núcleo 107/107). `CSP-nonce-fixo-zonas`, no
shell, é equivalente: só o CSP da zona chega ao navegador (`saidas/CSP-nonce-fixo-zonas.csp.txt`).

## Por que CLEAN e não veto
Nenhuma mutação do código auditado sobrevive na classe dos vetos anteriores (fail-open em página de módulo que existe; sonda
sem timeout). O buraco da completude do L1 só aparece com uma página que o produto ainda não tem; o nonce fixo nas zonas é a
mesma classe que a iteração 3 classificou como lacuna. **Se uma página dinâmica irmã de uma literal entrar numa zona, o
buraco do L1 vira o V1 de novo, com a suíte verde.**

## Lacunas (por prioridade), com teste mínimo
1. **Completude do L1 aceita `[secao]`/`[...resto]` cobertos por uma entrada literal irmã, pula `(publico)` e `page.{ts,jsx,js}`.**
   Correção: exigir, para cada página, uma entrada que o Next roteie para **ela** (para segmento dinâmico, a chave não pode
   ser nome de irmão literal), ler `page.(tsx|ts|jsx|js)` e não pular `(publico)` nas zonas (ou exigir lista explícita de
   páginas públicas). Mesmo ajuste no "invariante 16 estatico". Teste de prova: G11 + `np-cadeia.sh`.
2. **Nonce da zona sem teste de renovação** (`D-/N-CSP-nonce-fixo-zonas`). G13 (`/zona1`, `/zona2` com nonces diferentes)
   pega; na unidade do núcleo, dois pedidos ao `criarProxy` com nonces diferentes.
3. **Nonce previsível** (contador, relógio). G12 (sem prefixo comum longo entre pedidos seguidos) pega.
4. **Sonda com timeout de 1,5 s passa** (`S-timeout-1500-instancia`). G14 (503 em < 1 s) pega; na linha de base passa.
5. **L7 interrompido deixa zona congelada que engana o `subir()`.** Sugestão: `derrubar()` mandar SIGCONT antes do SIGTERM
   e registrar handler de SIGINT/SIGTERM que descongela; `esperar()` com timeout por tentativa.
6. Mantidas da iteração 3: trace forjado só na unidade do núcleo; 413 sem `lerComLimite` indistinguível pelo HTTP;
   `T-413-le-tudo` pego por morte do arquivo; "L1 tem dentes" usa `donos` separado, e uma entrada nova em
   `CONTEUDO_DE_MODULO` sem dono não tem dentes (a completude não exige o dono).

## Arrumação
- Portas 3000–3003, 4001–4004 e 4010 livres no fim (`ss -ltnH`: nenhuma). Sobrou só um `next-server` defunct (zumbi, sem
  porta). Verdaccio não foi tocado.
- Árvore real: os 8 submódulos sem alteração; no principal só `.agents/auditor_shell_4/` é meu
  (`.agents/seguranca_2026-09-22/` não é deste agente). Nada instalado, nenhum commit.
