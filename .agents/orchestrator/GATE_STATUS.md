# Registro de gates

> Um bloco por rodada: agentes, veredito, fonte e resultado. Os gates da PoC (M1, M2, final) e as
> pastas dos verificadores encerrados estão na tag `historico-2026-09-22`; os caminhos
> `.agents/arquivo/...` e `.agents/*_shell_1/` citados abaixo existem só nela.

## Gate — Base genérica (ADR-0009), iteração 1, HEAD 1b9e811
| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_base_1 | revisor-mfe (opus) | REQUEST_CHANGES | .agents/arquivo/reviewer_base_1/handoff.md | 0 bloqueantes; 5 importantes: repositórios sem remoto; manifesto `plataforma` cria perfil global (inv. 17); escrita de sessão na raiz do núcleo (inv. 15); host de toast ignora flash novo; erro de sessão em action vira tela genérica (inv. 12) |
| challenger_base_1 | simulador-condicoes (sonnet) | REQUEST_CHANGES | .agents/arquivo/challenger_base_1/handoff.md | A1: action executa sem `Origin` (checagem do Next fail-open); sem boundary de erro; gestão de acesso fora = página vazia; domínio A fora derruba /zona1; 20/20 automáticos; p95 192 ms em GET /zona1 |
| auditor | — | não despachado | — | aguardou a correção |

Gate Result: **FAIL**. Correções: contratos b10d55f, núcleo d5912ce (0.3.0, `@erp/nucleo/shell`), moldura fd618c9,
stub b5c8ac7, shell a28b80a, zona-1 a3883ec, zona-2 dbaa10d, zona-acesso d81dd34. Pacotes 15/58/11/16, ponta a ponta 23/23.
Pendente de decisão do humano: remotos dos cinco repositórios só locais (achado 1 do revisor).

## Gate — Base genérica, iteração 2, HEAD 8aa5a3e
| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_base_2 | revisor-mfe (sonnet) | REQUEST_CHANGES (condicional) | .agents/arquivo/reviewer_base_2/handoff.md | todos os achados da iteração 1 resolvidos; nenhuma regressão; faltava só rodar a ponta a ponta, bloqueada pelas portas |
| auditor_base_1 | general-purpose forense (opus) | **INTEGRITY VIOLATION** | .agents/arquivo/auditor_base_1/handoff.md, mutacoes.txt | números reproduzidos (15/58/11/16, 23/23); 20 mutações exigidas pegas; veto: V1 Origin só testado na zona de acesso (X1 sobrevive na zona 2), V2 "uma vez" do toast não verificado (X5), V3 degradação sem teste, V4 ilhas sem teste (X3, X4, X6, X22) |
| challenger | — | não despachado | — | aguardou a correção |

Gate Result: **FAIL** (veto do auditor). Correções: núcleo 78980a4 (0.3.1: proxy consome o flash; testes de parâmetro
hostil afirmam a recusa), moldura a268f66 (0.3.0: `executarAcao` testável; host de toast executado com hooks falsos),
stub 1517c5e (um processo por domínio), shell 6e05e55, zona-1 a315918, zona-2 8f36ff2, zona-acesso 4c8c302
(indisponibilidade no HTML do servidor). Verificação: pacotes 15/60/16/16; ponta a ponta 26/26, com Origin em toda action
de toda app, toast uma vez com pote de cookies, domínios derrubados um a um e restrição de módulo comportamental.
Mutantes do auditor conferidos pelo orquestrador: X22 e X6 agora reprovam a moldura.

## Gate — Shell novo (Gabriel), iteração 1, erp-shell a63b995 / zonas bac6d37…

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_shell_1 | revisor-mfe (sonnet) | REQUEST_CHANGES | .agents/reviewer_shell_1/handoff.md | fail-open de `exigirModulo` nas 4 apps; `proxy.ts` do shell reimplementa CSP sem `form-action`/`img-src`; telemetria sem `Content-Length` bufferiza tudo; limitador não expira. Refutou R1 (caminho normalizado) e a sonda em página com sessão |
| challenger_shell_1 | simulador-condicoes (sonnet) | REQUEST_CHANGES | .agents/challenger_shell_1/handoff.md | C1: `/ZONA2` (maiúsculas) escapa da sonda → 500 cru; janela de 500 cru até ~0,8 s após a queda; recuperação 1,2 s; zona travada segura ~0,6 s; telemetria aceita 20 MB sem `Content-Length`. 26/26 |
| auditor_shell_1 | general-purpose forense (opus) | **INTEGRITY VIOLATION** | .agents/auditor_shell_1/handoff.md, mutacoes.txt | V1 **vazamento medido**: gestão de acesso fora → quem não tem módulo recebe o conteúdo restrito no payload RSC; fail-open e fail-closed indistinguíveis nas suítes. V2 `/api/otel` anônimo é repassado ao coletor. V3 503 só testado na função pura (500 cru, TTL infinito, sem timeout sobrevivem). Testes mínimos em `anexos/lacunas.test.mjs` |

Gate Result: **FAIL** (veto do auditor + dois REQUEST_CHANGES). Rodada de correção: fail-closed nas 4 apps
com o teste L1 do auditor; telemetria descarta anônimo e limita em streaming; C1 case-insensitive; CSP do
shell alinhada; L2–L4 na verificação ponta a ponta.

## Gate — Shell novo, iteração 2, erp-shell 4255635 / zonas a0d9bc1…

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_shell_2 | revisor-mfe (sonnet) | REQUEST_CHANGES | .agents/reviewer_shell_2/handoff.md | os 7 achados da iteração 1 resolvidos; novos: `__Host-flash` apagado sem `Secure`; id de zona com maiúscula reabriria o C1; 400 da telemetria sem teste |
| challenger_shell_2 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_shell_2/handoff.md | C1 fechado nas 3 zonas; nada de módulo no HTML/RSC com a gestão de acesso fora; telemetria 413 em streaming; 30/30. Lacuna: navegação RSC real |
| auditor_shell_2 | general-purpose forense (opus) | **INTEGRITY VIOLATION** | .agents/auditor_shell_2/handoff.md, mutacoes.txt | 48 mutações. Veto: fail-open só na zona 2 deixa tudo verde (L1 só visitava a zona 1). Lacunas: CSP do shell, 429/400 da telemetria sem teste de repasse, sonda (timeout, ≥500, ordem), `/api/*` |

Gate Result: **FAIL**. Correção (shell `72e0475`, zonas `f26fd7c`/`8627c02`/`ee623ab`, núcleo 0.6.0 `e624c0c`):
L1 cobre toda página de módulo das 3 zonas, com teste de "dentes"; L6 com navegador real (navegação do
cliente); G2 CSP, G4 repasse da telemetria, G5 asset de zona morta, T1 trace; U1–U6 na unidade; prefixo
de `/api/otel` e `/api/auth` por segmento (U6 achou `/api/otelx` sem cookie). **Provas:** fail-open só na
zona 2 → L1 reprova; fail-open na zona 1 → L1 e L6 reprovam (L6 pela resposta `?_rsc=`).
`base/verificacao` 47/47, duas vezes. Próximo: iteração 3.

## Gate — Shell novo, iteração 3, erp-shell 72e0475 / zonas f26fd7c, 8627c02, ee623ab / núcleo 0.6.0

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_shell_3 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_shell_3/handoff.md | achados da iteração 2 e o veto fechados, com testes rodados; nada novo |
| challenger_shell_3 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_shell_3/handoff.md | navegação real nas 16 combinações sem vazar módulo; trace forjado substituído; CSP única; flash uma vez; 47/47 |
| auditor_shell_3 | general-purpose forense (opus) | **INTEGRITY VIOLATION** | .agents/auditor_shell_3/handoff.md, mutacoes.txt | 53 mutações; V1 da iteração 2 fechado. Veto: **V1** fail-open só em `/zona1/recursos/[id]` passa (L1 tinha 4 das 5 páginas de módulo) e vaza o detalhe; **V2** sonda do proxy sem timeout passa (L2 usa SIGKILL). Lacunas: nonce fixo, 413 sem `lerComLimite` indistinguível pelo HTTP, trace forjado só na unidade |

Gate Result: **FAIL** (veto). Correção só na verificação (nenhum código de produto mudou): `/zona1/recursos/r-1` no L1
e no "L1 tem dentes"; teste novo que reprova se uma página de módulo das zonas não tiver entrada no L1; `congelarApp`
(SIGSTOP) em `base/scripts/ambiente.mjs` e L7 (zona travada → 503 em < 2 s); L8 (nonce muda a cada requisição);
comentário do L4 corrigido. **Provas:** as mutações V1 e V2 do auditor aplicadas juntas → reprovam exatamente L1 e L7
(48/50); linha de base **50/50** duas vezes. Próximo: iteração 4.

## Gate — Shell novo, iteração 4 (só a verificação mudou; produto igual à iteração 3)

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_shell_4 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_shell_4/handoff.md | testes novos provam o que dizem; nit: `congelarApp` sem guarda |
| challenger_shell_3 | simulador-condicoes (sonnet) | APPROVE (iteração 3) | .agents/challenger_shell_3/handoff.md | não redespachado: nenhum código de produto mudou desde a aprovação dele |
| auditor_shell_4 | general-purpose forense (opus) | **CLEAN** | .agents/auditor_shell_4/handoff.md, mutacoes.txt | 61 mutações; V1 e V2 da iteração 3 reprovam L1 e L7; nonce fixo no shell reprova L8; 50/50 duas vezes. Lacunas sem veto: completude do L1 não distingue `[secao]` irmã de página literal; nonce fixo/previsível nas zonas; sonda de 1,5 s passa no L7; L7 interrompido deixa a zona congelada |

Gate Result: **PASS** — shell novo (503 de zona, sonda, telemetria, CSP e trace do núcleo 0.6.0) aprovado.
Lacunas do auditor_shell_4 viram endurecimento imediato da verificação (fora do gate).
