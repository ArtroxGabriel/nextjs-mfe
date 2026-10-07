# Registro de gates

> Um bloco por rodada: agentes, veredito, fonte e resultado. Os gates da PoC (M1, M2, final) e as
> pastas dos verificadores encerrados estão na tag `historico-2026-09-22`; os caminhos
> `.agents/arquivo/...` e `.agents/*_shell_1/` citados abaixo existem só nela; `*_shell_2` está na história do
> git e `*_shell_3`/`*_shell_4`, na tag `gate-shell-aprovado`.

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

## Gate — Kit de aplicação (B1) + Sessão no Redis (D1), iteração 1 (núcleo 0.8.2 / moldura 0.4.0)

> Pastas dos verificadores removidas em 2026-09-28; a última versão delas está no commit `7b10eae` (`git show 7b10eae:.agents/<nome>/handoff.md`).

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_b1_d1_1 | revisor-mfe (gemini) | APPROVE | .agents/reviewer_b1_d1_1/handoff.md | migração para o kit concluída nas 4 apps; cópias locais eliminadas; leitor/escritor estritamente segregados (invariante 15); hash SHA256 nas chaves Redis; conformidade estrita com os 17 invariantes |
| challenger_b1_d1_1 | simulador-condicoes (gemini) | APPROVE | .agents/challenger_b1_d1_1/handoff.md | ponta a ponta `task verificar:redis` 60/60 verde; fail-closed em falha de Redis confirmado sem vazamento (invariante 12); inspeção de chaves e TTL validada; testes de unidade e estáticos 100% |
| auditor_b1_d1_1 | auditor-forense (gemini) | **CLEAN** | .agents/auditor_b1_d1_1/handoff.md, mutacoes.txt | 7 mutações essenciais testadas (chave crua no Redis, fail-open de rede, bypass de REDIS_URL, fail-open em exigirModulo, bypass de Origin, link entre zonas, prop sensível JSX) — todas capturadas e reprovadas pelas suítes |

Gate Result: **PASS** — B1 (Kit de app no núcleo e moldura) e D1 (Persistência de sessão no Redis) aprovados integralmente.


## Gate — Kit de aplicação (B1) + Sessão no Redis (D1), iteração 2 (núcleo 0.8.2 / moldura 0.4.0 / contratos 0.3.1)

Rodada pedida pelo humano: a iteração 1 fez 7 mutações e usou verificadores fora do processo. Escopo ampliado ao que
entrou sem verificação independente: núcleo 0.8.0–0.8.2 (acesso v2, campos OIDC, timeouts), B3, B4/B6, B5a.

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| auditor_b1_d1_2 | general-purpose forense (opus) | **INTEGRITY VIOLATION** | .agents/auditor_b1_d1_2/handoff.md, mutacoes.txt, anexos/ | 77 mutações de código (54 pegas, 23 sobreviventes) + 29 contornos das checagens estáticas (28 passaram) |

Vetos: **V1** zona grava e apaga sessão direto no Redis (`clienteRedis.set/del`) e o ponta a ponta fica 60/60 (inv. 15);
**V2** `@erp/nucleo/app` pode exportar `criarNucleoDoShell` (inv. 15); **V3** `server-only` verificado por texto; `'use client';`
com ponto e vírgula ou comentário desliga a regra P0 (inv. 3); **V4** fallback v2 → v1 concede com 401/403/500/timeout
(inv. 9/16); **V5** DTO por spread para ilha `'use client'` passa (inv. 2); **V6** `exigirModulo(id, funcionalidade)` ignorando a
funcionalidade passa (inv. 16); **V7** `NEXT_PUBLIC_*` com endpoint interno passa, `next.config.ts` não é varrido (inv. 11);
**V8** `Reflect.get(globalThis,'fe'+'tch')`, `createRequire('undici')`, `child_process` passam no N8 (inv. 4).
Lacunas: L1 health sem efeito (404 conta como "no ar"); L2 limites sem teto e `lerNumeroPositivo` do núcleo sem teste;
L3 sonda aceita `redirect: 'follow'`; L4 Redis caído espera 5 s do `connectTimeout`; L5 `acesso.test.mjs` trava ao reprovar;
L6 `obterEu` com CPF; L7 `ehSessao` aceita sessão sem token; L8 `<Link>` via expressão e clientes de banco fora do N8.

Gate Result: **FAIL** (veto). A iteração 1 (PASS) fica superada. Correção: V4, V6 e L6 pelo G3 (adendo 1 do ADR-0014,
corte seco); V1, V2, V3, V5, V7, V8 e as lacunas numa fatia de correção antes da iteração 3. Estado final conferido pelo
orquestrador: fontes iguais ao início, `dist` instalado igual ao tarball 0.8.2 nas 4 apps, 60/60 nos dois modos.

## Gate — B1 + D1 + G3 (acesso v2) + fatia K, iteração 3 (contratos 0.4.0 / núcleo 0.9.2 / moldura 0.5.0)

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_b1_d1_3 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_b1_d1_3/handoff.md | V1–V8 e L1–L8 da iteração 2 com correção e teste; notas: fallback `REDIS_URL_ZONA ?? REDIS_URL`, `valorSeguro` aceita qualquer import |
| challenger_b1_d1_3 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_b1_d1_3/handoff.md | base no ar: v2 fora sem voltar à v1, desligado → login, ACL do Redis NOPERM, sonda 404/307/travada → 503, sem vazamento; M1: negação antes do domínio só provada indiretamente |
| auditor_b1_d1_3 | general-purpose forense (opus) | **INTEGRITY VIOLATION** | .agents/auditor_b1_d1_3/handoff.md, mutacoes.txt, anexos/ | 127 mutações e contornos: 72 pegos, 55 sobreviventes (interrompido uma vez pelo limite de uso e retomado) |

Fechado desde a iteração 2 (agora pego): fallback v1, erro do `/v2/eu` virando lista, funcionalidade ignorada, CPF/papéis no
acesso efetivo, `force-cache`, `set` no cliente da zona, escrita com a credencial ACL, spread de DTO, health 404, `server-only` em comentário.

Vetos: **V1** (inv. 15) zona conecta com `REDIS_URL` e monta o comando em tempo de execução → grava sessão forjada, 71/71; o fallback
`?? REDIS_URL` real entrega a credencial de escrita se `REDIS_URL_ZONA` faltar. **V2** (inv. 15) escritor reexportado com outro nome em
`/app` ou na raiz passa (teste compara nomes; regex da fronteira não aceita aspas duplas). **V3** (inv. 3) `lib/redis.ts`, `lib/nucleo.ts`,
`lib/pagina.ts` das zonas sem `server-only` passam; `temServerOnly` aceita template literal. **V4** (inv. 2) `campos={{…, cadastro:
JSON.stringify(p)}}` põe o CPF no HTML de `/acesso`, 71/71; `valorSeguro` aceita template, `String()`, chamada em objeto, qualquer import;
não vê filho da ilha, barril, alias. **V5** (inv. 5) mutação: action da zona de acesso chamando o domínio antes de `acaoProtegida` passa —
o teste de Origin usa campos da v1, que o domínio recusaria de qualquer jeito. **V6** (inv. 4) exceção do N8 pula `lib/redis.ts` inteiro;
varredura só em `app/`, `lib/`, `proxy.ts`; alias de `globalThis`, `process.getBuiltinModule`, `node:dns`, `.constructor` passam.
**V7** (inv. 11) `next.config` com `env:`/`compiler.define` expondo endpoint interno sem `NEXT_PUBLIC_`; `NEXT_PUBLIC_BEARER`.
Lacunas L1–L8: health que toca domínio; semente sem ator só com `tarefas.ver`; link de Relatórios para todos; `precisaConstruir` e checagem
de portas sem teste; `<Link>`/`router.push`; `TIMEOUT_PADRAO_MS` só por texto, TTL da sonda, só "saudável" em cache, módulo com nome vazio;
N53 (`same-site`), G02, G05 do mock.

Gate Result: **FAIL** (veto). Revisor e challenger aprovaram; a correção (fatia K2 no `RETOMADA.md`) vai para a iteração 4, com os três
verificadores novos (o auditor vetou comportamento que o challenger não exercitou: P09 e E10c). Estado conferido pelo orquestrador ao fim:
fontes iguais ao início, `dist` = tarball 0.9.2 nas 4 apps, portas livres, `tee` residual do auditor encerrado.

## Gate — B1 + D1 + G3 (acesso v2) + fatias K e K2, iteração 4 (contratos 0.4.0 / núcleo 0.9.2 / moldura 0.5.0)

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_b1_d1_4 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_b1_d1_4/handoff.md | V1–V7 e L1–L8 da iteração 3 com correção e teste; nota: `P0-acao-protegida` exige `return acaoProtegida(` como primeira instrução |
| challenger_b1_d1_4 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_b1_d1_4/handoff.md | 88/88 e 85+3; P09, E10c (inclusive Chrome real), E01b/c, zona avulsa sem `REDIS_URL_ZONA`, health, If-Match exercitados |
| auditor_b1_d1_4 | general-purpose forense (opus) | **INTEGRITY VIOLATION** | .agents/auditor_b1_d1_4/handoff.md, mutacoes.txt, anexos/ | 127 mutações e contornos: 72 pegos, 55 sobreviventes (7 equivalentes; 5 só no estático, pegos no ponta a ponta) |

Fechado desde a iteração 3 (agora pego): E01b/E01e, E02–E02c, E10b/E10c, XE23–XE25, XE27–XE40, XR08–XR17, XF01, N08b, N36b, N38b/c,
N53, A05, G02, G05, S05, S17, AM1–AM3, P09b, P10, P12/P12c, E05, zona sem `REDIS_URL_ZONA`, t-1 na versão 3.

Vetos: **V1** (inv. 15, E01f) a zona ainda recebe `REDIS_URL` no ambiente: conexão de passagem grava sessão forjada e fecha antes do
`CLIENT LIST`, 88/88. **V2** (inv. 15, N38d–f) escritor embrulhado numa função nova na raiz ou em `/app` passa o teste de identidade.
**V3** (inv. 2, E10d/XE26) `valorSeguro` aceita `x.campo` que é objeto (`CC-10` no HTML de `/zona1`); ilha por `createElement`,
`next/dynamic`, barril com `export const`, apelido condicional. **V4** (inv. 4, XR20p/XR38p/XR23p) parâmetro `fetch` esconde a global,
`fontesDaApp` pula `test/` em qualquer nível, `next/*` inteiro permitido (`next/dist/compiled/ws`). **V5** (inv. 11, XN01p) `config.env = {…}`
por atribuição, chave calculada e spread de outro arquivo no `next.config`.
Lacunas: L1 contornos do `P0-acao-protegida`; L2 `If-Match` fixo "3" (N4 usa justo a t-1); L3 cache de "fora" por 1 ms; L4 P1 por
`router.push(variavel)`/push desestruturado/`Link` por const; L5 `rewrites()` e `assetPrefix` para endereço interno.

Gate Result: **FAIL** (veto). Correção na fatia K3 (`RETOMADA.md`). Estado conferido pelo auditor ao fim: fontes iguais, `dist` = tarball
0.9.2, dados do stub iguais, chave forjada apagada, 88/88, portas livres.

## Gate — B1 + D1 + G3 (acesso v2) + fatia K3, iteração 5 (contratos 0.4.0 / núcleo 0.9.2 / moldura 0.5.0)

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_b1_d1_5 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_b1_d1_5/handoff.md | Escopo K3 e Medição 1 confirmados; 20/20 contratos, 136/136 núcleo, 26/26 moldura, 43/43 stub, 43/43 shell; estática 38/38; typecheck 0 erros; 8 submódulos em lockstep |
| challenger_b1_d1_5 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_b1_d1_5/handoff.md | V1 a V5 fechados; 32 contornos enquadrados na Decisão A2; E2E V1 (/proc/<pid>/environ), V3 (ausência de CC-10 em /zona1), V5 (.next/static), L2 (t-2 versão 1) validados; Medição 1 comprovou revogação por concorrência |
| auditor_b1_d1_5 | general-purpose forense (opus) | **APPROVE** (NO INTEGRITY VIOLATION) | .agents/auditor_b1_d1_5/handoff.md, mutacoes.txt | Mandato A2 aplicado: correções K3 fecharam vulnerabilidades reais de produto (V1, V3, V5); contornos deliberados de analisadores estáticos classificados como limites; nenhum defeito real de produto |

Gate Result: **não aceito** (humano, 2026-09-23, após revisão do orquestrador). A auditoria descreveu 6 mutações sem evidência
(a iteração 4 executou 127) e o V3 continuava aberto: `valorSeguro` barrava só uma lista de nomes, e `extra={envio.resumo}` com
objeto passava sem achado. Correção na fatia K4 (V3 pelo verificador de tipos; limites em `DEFERRED.md` D14); iteração 6 a seguir.
As pastas `.agents/*_b1_d1_5/` saíram com `git rm`; estão no commit `bf40a18`.

## Gate — B1 + D1 + G3 (acesso v2) + fatias K3/K4, iteração 6

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_b1_d1_6 | revisor-mfe (sonnet) | REQUEST_CHANGES | .agents/reviewer_b1_d1_6/handoff.md | `iniciar` em `ambiente.mjs` descartava o 4º argumento: `envDaApp` era código morto e toda zona recebia `REDIS_URL`; V2–V5 e L2/L3 fechados com teste; XN09 sem registro |
| challenger_b1_d1_6 | simulador-condicoes (sonnet) | REQUEST_CHANGES | .agents/challenger_b1_d1_6/handoff.md | `task verificar:redis` 96/98 (`base.test.mjs:482` e `:909`), 2x; sessão forjada da carla gravada com a `REDIS_URL` da zona abriu `/` e `/acesso`; V3 (tipo), V5, If-Match, 401/404/403 e revogação sustentam |
| auditor | — | não despachado | — | gate já reprovado pelos dois |

Gate Result: **FAIL**. A K3 nunca foi rodada no modo Redis nem, depois do teste novo, no modo arquivo. Correção **K4-3**: `iniciar(cmd, args,
cwd, envProc)` usa o ambiente por processo; o teste `:482` injeta `REDIS_URL` de propósito para provar a recusa do produto; a parte do shell
em `:909` só vale no modo Redis; XN09 em D14. Conferido: `task verificar:redis` 98/98, `task verificar` 95 + 3 pulados. Iteração 7 a seguir.

## Gate — B1 + D1 + G3 (acesso v2) + fatias K3/K4, iteração 7

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_b1_d1_7 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_b1_d1_7/handoff.md | K4-3 corrige o V1; sem veto. Não bloqueantes: domínios falsos recebiam `REDIS_URL`; XN09 é erro de boa-fé, não cabe em D14 |
| challenger_b1_d1_7 | simulador-condicoes (sonnet) | REQUEST_CHANGES | .agents/challenger_b1_d1_7/handoff.md | 98/98 e 95+3, 2x cada; nenhuma zona tem `REDIS_URL`. Mas o usuário `default` do Redis do showcase era `nopass`: só com o endereço (público no Taskfile) gravou sessão forjada da carla, aceita em `/` e `/acesso` |
| auditor | — | não despachado | — | gate já reprovado |

Gate Result: **FAIL**. Correção **K4-4**: `--requirepass` no usuário de escrita (`ERP_REDIS_SENHA_SHELL`, `docs/CONFIGURACAO.md`), `REDIS_URL`
com a senha no Taskfile e no `subir.mjs`; teste novo prova que conexão sem senha recebe `NOAUTH` e que nenhum domínio falso recebe
credencial do Redis; domínios e `pnpm registrar` sobem sem a credencial de escrita; XN09 vira regra estática (`assetPrefix`/`basePath` só
literal) com teste, e sai do D14. Conferido: `task verificar:redis` 100/100, `task verificar` 96 + 4 pulados, estática 40/40. Iteração 8 a seguir.

## Gate — B1 + D1 + G3 (acesso v2) + fatias K3/K4, iteração 8

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_b1_d1_8 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_b1_d1_8/handoff.md | K4-4 fecha o Redis anônimo; XN09 com regra; domínios sem credencial |
| challenger_b1_d1_8 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_b1_d1_8/handoff.md | 100/100 e 96+4, 2x; forja sem senha → NOAUTH, com a senha da zona → NOPERM, 6 senhas fracas → WRONGPASS |
| auditor_b1_d1_8 | general-purpose forense (opus) | **FAIL (4 vetos)** | .agents/auditor_b1_d1_8/handoff.md, mutacoes.txt, anexos/ | 127 do catálogo da it.4 reaplicadas (todos os vetos de então agora reprovam) + ~60 novas |

Vetos: **V1** (inv. 15) a barreira de ambiente é lista de exclusão e só vale no `start`: com `ERP_REDIS_SENHA_SHELL` definida (como a
documentação manda fora da máquina local) a senha de escrita chega às zonas e domínios, e a zona 1 gravou sessão forjada da carla
(`anexos/prova-senha-shell.log`); o `pnpm build` das zonas (`ambiente.mjs:172`) roda com `REDIS_URL` (E01g: gravação no carregamento do
módulo durante o build, 100/100). **V2** (inv. 4, N8) a pilha de escopos não abre escopo em `constructor`, acessor, `catch` e `for`: um
`constructor(fetch)` esconde o `fetch` global (XR20q4: 38 chamadas ao alvo externo, 100/100). **V3** (inv. 4) a correção do XR38p não
tem teste (SR3: voltar a pular `test/` em qualquer nível dá 40/40). **V4** (inv. 15) a fronteira do núcleo é lista fixa de nomes e isenta
o arquivo definidor (N38g/h/i/k/l, 136/136).
Lacunas sem veto: L1 `ehTipoEscalar`/`programaDaApp` sem dentes em TA1/TA4/TA5/TA9 (os erros de boa-fé T1–T8 são pegos); L2 SR1/SR6/SR7;
L3 XN09 por shorthand ou atribuição; L4 FR2; L5 S17c; L6 AMB4/AMB6.
D14 confirmados: XA09–XA13, XP01/XP03–06, XN02–04, XN09d, XR28c/d, XL01–04, XN08, XR30.

Gate Result: **FAIL** (veto). Correção na fatia **K5** (`RETOMADA.md`). Estado conferido pelo auditor ao fim: fontes iguais ao HEAD, `dist`
= tarball 0.9.2, dados do stub iguais, chaves forjadas apagadas, `CONSTRUIR=1 task verificar:redis` 100/100, portas livres.

Correção **K5** (2026-09-28), cada item com teste que reprova com a correção revertida (conferido por mutação):
- **K5-1 (V1, L6):** `base/scripts/ambiente.mjs` monta o ambiente por **lista de inclusão** por papel (`AMBIENTE_PERMITIDO`,
  `ambienteDoPapel`, `papelDe`); todo processo (build, start, registrar, domínio, app avulsa) nasce por um único `executar`, que
  registra o que entregou (`ambientesEntregues`). Testes: unidade (senha em nome qualquer não passa; ponto único de lançamento;
  a lista cobre toda variável lida por zona e domínio) e ponta a ponta com `ERP_REDIS_SENHA_SHELL` sempre definida (nenhum
  ambiente entregue nem `/proc/<pid>/environ` de zona ou domínio contém a senha; o do shell contém). `showcase/subir.mjs` herda o filtro.
- **K5-2 (V2, L2/SR1, SR6):** `saida-de-rede.mjs` troca a pilha de escopos por resolução léxica (um nome só é local se um ancestral
  do uso o liga: função de qualquer forma, `catch`, os três `for`, bloco, `case`). Achado no caminho: `globalThis[k]` com `k`
  parâmetro passava (o mapa de constantes devolvia `undefined` e a regra de chave calculada nunca disparava); a constante agora é a
  da declaração que vale ali. Testes: 12 formas × `fetch`/`WebSocket`, XR20q4, chave de parâmetro e de constante sombreada, concatenação inline.
- **K5-3 (V3):** teste de `fontesDaApp` com `test/` aninhado (varrido) e na raiz (fora).
- **K5-4 (V4, L4):** `erp-nucleo` `08642ed`: símbolos exclusivos derivados de `src/shell/index.ts`; no definidor só a declaração
  é isenta; regra por tipo (fora de `shell/` e `testing/`, nenhum export cujo tipo tenha `gravar`/`remover`/`autenticar`/`entrar`/
  `encerrar`). Testes N38g, N38h, N38i (estático e no `dist`), N38k, N38l numa cópia do `src/` real. Só `scripts/` e `test/`
  mudaram: o `dist` publicado é o mesmo, **sem núcleo 0.9.3**.
- **L1:** união com objeto e objeto opcional (TA1); `varrerSeguranca` ganhou `raiz` e um teste da varredura inteira (TA4, TA5, TA9).
  **L3:** `assetPrefix`/`basePath` abreviados ou atribuídos depois.
- Conferido: núcleo 142/142, contratos 20, moldura 26, stub 43, shell 43, typecheck das 4 apps, scripts 18, estática **48/48**,
  `CONSTRUIR=tudo task verificar:redis` (build das 4 apps com o ambiente novo) e depois `task verificar:redis` **109/109**,
  `task verificar:construir` **105 + 4 pulados**. Iteração 9 a seguir, com o catálogo da iteração 8 como piso.

## Gate — B1 + D1 + G3 (acesso v2) + fatias K3/K4/K5, iteração 9

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_b1_d1_9 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_b1_d1_9/handoff.md | V1–V4 fechados, cada reversão derruba o teste do veto; suspeita: núcleo gravando por cliente Redis sem tipo de escritor |
| challenger_b1_d1_9 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_b1_d1_9/handoff.md | 109/109 e 105+4, 2x; senha só no shell no showcase ao vivo; NOPERM/NOAUTH; XR20q4 e E01g pegos. Divergências (showcase sem `ping` autenticado; completude sem desestruturação) corrigidas em `c4b94e6` |
| auditor_b1_d1_9 | general-purpose forense (opus) | **PASS** | .agents/auditor_b1_d1_9/handoff.md, mutacoes.txt, anexos/ | catálogo da it.8 inteiro reaplicado: todo veto de então reprova; E01g com build real 109/109 e sem chave; lacunas LA–LG sem veto (`DEFERRED.md` D15) |

Gate Result: **PASS**. Fecha B1 (kit nas 4 apps), B3 (`/{zona}/api/health`), B4/B6 (verificações estáticas), D1 (sessão no Redis com
escrita só no shell) e G3 (acesso v2). Estado conferido ao fim: fontes nos HEADs, `dist` do núcleo nas 4 apps = tarball 0.9.2
(`9ff2f87f…`), dados do stub iguais, chaves forjadas apagadas, `task verificar:redis` 109/109, modo arquivo 105 + 4, portas livres.
Pastas dos verificadores das iterações 2–9 removidas depois do registro; última versão no commit `f010760`
(`git show f010760:.agents/<nome>/handoff.md`). Tag `gate-b1-d1-g3-aprovado`.

## Gate — D2 (OIDC + PKCE, renovação proativa com lock; núcleo 0.10.2), iteração 1, HEAD `b8a1034`

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_d2_1 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_d2_1/handoff.md | sem bloqueante; menores: `server-only` em `erp-shell/lib/cookies.ts`, `trim` em `SHELL_HOSTS` no `sair` |
| challenger_d2_1 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_d2_1/handoff.md | PKCE/state/redirect_uri, varredura de tokens, ACL do Redis, logout CSRF, loopback, JWT do stub; suítes 2x verdes; D19 medido; divergências de documento (CONFIGURACAO §5, contagem de testes, eva no estado persistido) |
| auditor_d2_1 | general-purpose forense (opus) | **VETO** | .agents/auditor_d2_1/handoff.md, mutacoes.txt | 144 mutações distintas, 127 pegas; veto por 3 testes faltando: P04 (páginas do shell sem renovação), F04 (`IDP_CLIENTE_SEGREDO` na lista da zona), L04 (id da transação = `state`); X01 limite declarado (D22); 13 equivalentes/sem defeito |

Gate Result: **VETO** (sem defeito de produto). `worker_d2_1` escreveu os testes (shell `bce8f59`, núcleo `aeae3af`, principal
`base/scripts/ambiente.test.mjs` e `oidc.test.mjs`): P04, F04, L04 e L07 pegos; shell 86/86, núcleo 226/226, scripts 21/21,
`verificar:oidc` 5/5. Iteração 2 com verificadores novos.

## Gate — D2, iteração 2, principal `0b650ad` (testes do veto), shell `bce8f59`, núcleo `aeae3af`

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_d2_2 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_d2_2/handoff.md | testes novos provam P04/F04/L04/L07 pela lógica; só `test/` mudou; núcleo 0.10.2 |
| challenger_d2_2 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_d2_2/handoff.md | `/` renova 1x com token vencido; `/proc/<pid>/environ` das zonas e domínios sem variável só do shell; cookie de login ≠ `state`; sem regressão; D19 observado em `/` |
| auditor_d2_2 | general-purpose forense (opus) | **VETO** | .agents/auditor_d2_2/handoff.md, mutacoes.txt (com trecho exato) | 56 mutações de produto, 27 de regressão em todas as famílias pegas; P04/F04/L04/L07 pegos; veto: L04h (`id = sha256(state)`), L04k (`id = state + '.login'`), L04j (`codeVerifier = sha256(state)`) passam no teste de `iniciar` |

Gate Result: **VETO** (sem defeito de produto). Correção: teste de independência dos segredos da transação (sorteios independentes de
`randomBytes`, ou derivação por hash/inclusão recusada) e as recomendações P04b e T3o; iteração 3 com verificadores novos.

## Gate — D2, iteração 3, principal `cf72700`, núcleo `83b00e0`, shell `3034f76` (núcleo 0.10.2)

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_d2_3 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_d2_3/handoff.md | troca de `randomBytes` restaurada no `finally`, sem vazamento; teste estrutural prova 4 sorteios independentes ≥ 32 bytes; só `test/` mudou |
| challenger_d2_3 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_d2_3/handoff.md | produto igual ao da iteração 2 fora de `test/`; suítes verdes (118/118, 5/5, 114+4); ataques centrais sem regressão |
| auditor_d2_3 | general-purpose forense (opus) | **PASS** | .agents/auditor_d2_3/handoff.md, mutacoes.txt (trecho exato) | 55 mutações, 55 pegas: veto da it.2 (6), variantes do teste estrutural (19), dentes do teste (4), restauração da troca, regressão por família (22), E09 no ponta a ponta |

Gate Result: **PASS**. Fecha o **D2** (#9): login OIDC + PKCE, transações de login de uso único, renovação proativa no `proxy.ts` do shell
com lock `SET NX PX`, domínios verificando RS256/JWKS, token de serviço restrito em modo JWT, `ERP_PERMITIR_HTTP_LOCAL` só loopback,
logout seguido até o Keycloak e `sair` só da mesma origem (ADR-0013 com adendos 1 e 2). Estado conferido ao fim pelo auditor: fontes
nos HEADs, `dist` do núcleo nas 4 apps = tarball 0.10.2, `task test` verde, `verificar:redis` 118/118, `verificar:oidc` 5/5, Keycloak
no padrão, portas livres. Pastas dos verificadores e workers das iterações 1–3 removidas depois do registro; última versão no commit
`0419774` (`git show 0419774:.agents/<nome>/handoff.md`). Tag `gate-d2-aprovado`. Depois: task D19-B (`DEFERRED.md` D19).

## Gate — D19-B (perdedor espera a renovação com token vencido; núcleo 0.10.3), iteração 1, principal `896c751`, núcleo `fdea296`, shell `72ecc2f`

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| reviewer_d19b_1 | revisor-mfe (sonnet) | APPROVE | .agents/reviewer_d19b_1/handoff.md | branch inteira no lugar da revisão final; sem Critical/Important; `ERP_DESTINO_TIMEOUT_MS ≥ 7500` com lock padrão recusa a configuração (documentado) |
| challenger_d19b_1 | simulador-condicoes (sonnet) | — (interrompido) | .agents/challenger_d19b_1/handoff.md | etapas 1–6 sem divergência; limite da API antes da 7; JWKS do stub frio: recuperação ~30 s depois de o IdP voltar |
| challenger_d19b_2 | simulador-condicoes (sonnet) | APPROVE | .agents/challenger_d19b_2/handoff.md | etapas 7–8: regressão do D2 sem divergência; `task test`, estática 51/51, `verificar:redis` 118/118 e `verificar:oidc` 6/6, 2x |
| auditor_d19b_1 | general-purpose forense (opus) | **VETO** | .agents/auditor_d19b_1/handoff.md, mutacoes.txt, sonda-erro-na-espera.test.mjs.txt | 96 registros, 81 pegos; E01 (0.10.2 no shell) reprova o e2e das 10 concorrentes; veto A10 (`valida(id).catch(() => null)` na espera: erro do store vira `ausente` e apaga a sessão, sintoma do D19), mais A10c/A10d do D2; observação B11 (`ESPERA_MS=''` recusado em vez de padrão) |

Gate Result: **VETO** (sem defeito de produto). Correção: testes em `erp-nucleo/test/identidade.test.mjs` (nos três stores) para erro do
leitor durante a espera, antes do lock e na releitura com o lock (A10, A10c, A10d) e, recomendado, no shell (`proxy-renovacao.test.mjs`)
store que lança com token vencido termina em `prosseguir` sem `limparSessao`. Iteração 2 com verificadores novos.

## Gate — D19-B, iteração 2 (só auditor: veto só por teste, regra do humano de 2026-10-06), principal `b1bacee`, núcleo `610217d`, shell `0a3131d`

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| worker_d19b_1 | correção do veto (opus) | — | .agents/worker_d19b_1/handoff.md | só `test/`: núcleo +9 (três momentos × três stores) e casos de `''`, 271/271; shell +6, 108/108; cada mutação do veto reprova só o seu momento |
| auditor_d19b_2 | general-purpose forense (opus) | **PASS** | .agents/auditor_d19b_2/handoff.md, mutacoes.txt | 34 registros, 32 pegos: veto da it.1 e 16 variantes (catch → `revogada`, laço inteiro, catch dentro de `valida`…), regressão 13/13 por família com E01; A10b pega e coerente com o ADR-0013; V11 viva sem veto (`lib/redis.ts` das apps → `DEFERRED.md` D26) |

Gate Result: **PASS**. Fecha a **D19-B** (`DEFERRED.md` D19 e D20): o perdedor do lock espera a renovação quando o token já venceu
(ADR-0013, adendo 3; núcleo 0.10.3). Estado conferido ao fim pelo auditor: fontes nos HEADs, `dist` do núcleo nas 4 apps = tarball
0.10.3, núcleo 271/271, shell 108/108, `task test` ok, `verificar:redis` 118/118, `verificar:oidc` 6/6, `showcase:checar` ok, portas
livres. Pastas dos verificadores e do worker removidas depois do registro; última versão no commit `fa93c2c`
(`git show fa93c2c:.agents/<nome>/handoff.md`). Tag `gate-d19b-aprovado`.

## Gate — D7 (zona travada: teto `ERP_ZONA_TETO_MS` como `proxyTimeout`), iteração 1, principal `f330cb7`, shell `45787f1`

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| revisor_d7_1 | revisor-mfe (sonnet) | **APPROVE** | .agents/revisor_d7_1/handoff.md | sem crítico nem importante; 4 menores (várias chamadas lentas sem bytes cortadas no teto; padrão/teto de `ERP_DESTINO_TIMEOUT_MS` copiados do núcleo; `??=` do L9 com variável vazia; dívidas antigas de `atual.md`) |
| challenger_d7_1 | simulador-condicoes (sonnet) | **APPROVE** | .agents/challenger_d7_1/handoff.md, out-*.txt | zona congelada solta em 10009–10016 ms (padrão) e 6010–6015 ms (6000); inválidos recusados na subida; streaming com bytes a cada 2 s não cortado; zona fora do ar 503 em 7–16 ms; `verificar` 115 + 4 pulados, `verificar:redis` 119/119 |
| auditor_d7_1 | general-purpose forense (opus) | **PASS** | .agents/auditor_d7_1/handoff.md, mutacoes.txt | 39 mutações, 36 pegas: as 4 do plano (`proxyTimeout` pelo L9; padrão, `<=` e teto pela unidade); vivas sem veto, por contorno (A2): E3 `proxyTimeout` fixo em 6000, E5 leitura sem validação no `next.config.ts`, M6b teto do destino 59_999 → `DEFERRED.md` D28 |

Gate Result: **PASS**. Fecha o **D7** na parte do teto (`DEFERRED.md` D7): a zona que não manda nenhum byte é solta em
`ERP_ZONA_TETO_MS` (10 s), não nos 30 s do Next; a página de indisponível dentro do teto passa ao C3. Estado conferido ao fim pelo
auditor: shell 114/114, `task verificar` 115 + 4 pulados, `verificar:redis` 119/119, árvores restauradas, portas livres. Pastas dos
verificadores removidas depois do registro; última versão no commit `aa26ba2` (`git show aa26ba2:.agents/<nome>/handoff.md`).
Tag `gate-d7-aprovado`.

## Gate — C1 (fragmentos entre zonas), iteração 1, principal `8182e2f`, shell `836ddc4`, zona 1 `39c4b76`, zona 2 `1626fd1`

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| revisor_c1_1 | revisor-mfe (sonnet) | **APPROVE** | .agents/revisor_c1_1/handoff.md | sem crítico nem importante; 6 menores (guarda sem colapsar `//`; `ehHtmlInerte` e `<img/onerror=`; 204 inútil para quem não tem a zona 2; `ZONA2_URL` inválida derruba a página; C1a/C1c sem título real; ADR cita `alvo.md`) |
| challenger_c1_1 | simulador-condicoes (sonnet) | **APPROVE** | .agents/challenger_c1_1/handoff.md | 50 grafias pelo shell, nenhuma alcança a rota (`//` e barra final: 308 para a canônica, que dá 404); dono conforme por ator, versão, chave e `Sec-Fetch-Dest`; nada vaza a bruno/davi/carla no HTML nem no RSC; painel 2,03 s com a zona 2 ou o domínio C congelados; `verificar` 119 + 4, `verificar:redis` 123/123 |
| auditor_c1_1 | general-purpose forense (opus) | **VETO (só por teste)** | .agents/auditor_c1_1/handoff.md, mutacoes.txt | 39 mutações, 30 pegas; vivas de boa-fé: E-Z4/E-Z4b (`escapar` removido), E-U1b (placeholder "indisponíveis" no painel, invariante 8), E-Z6/E-Z6b (filtro de pendentes); `ehHtmlInerte` confirmado frouxo (defeito do núcleo, `DEFERRED.md` D29) |

Gate Result: **VETO (só por teste)**. Correção: tarefas com título hostil e uma concluída na semente do domínio C (decisão do
humano: conta como teste) e asserções de título, escape e ausência em C1a/C1c. Iteração 2: só um auditor novo.

## Gate — C1, iteração 2 (só auditor: veto só por teste), principal `1edc130` (correção em `ca0f4b6`), stub `b85540c`

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| worker_c1_1 | correção do veto (opus) | — | .agents/worker_c1_1/handoff.md | só teste e semente: `t-3` com título hostil e `t-4` concluída; C1a/C1c conferem título escapado, cru ausente, concluída ausente; bruno/davi sem `/tarefa\|zona 2/i`; as 5 do veto reprovam |
| auditor_c1_2 | general-purpose forense (opus) | **VETO (só por teste)** | .agents/auditor_c1_2/handoff.md, mutacoes.txt | as 5 do veto pegas; 13 variantes, 7 pegas; vivas de boa-fé: placeholder com outro texto (V-U1c "Bloco indisponível", V-U1d `<p>—</p>`, V-U1f `<section>` "Pendências") e escape aplicado à lista inteira (V-Z4e); V-Z6d (`versao === 1`) é contorno; regressão por família 12/12 |

Gate Result: **VETO (só por teste)**. Correção: no C1c, a estrutura do painel de bruno/davi sem nenhum elemento além dos blocos
deles; no C1a/C1c, `<li>` com o título escapado. Iteração 3: só um auditor novo.

## Gate — C1, iteração 3 (só auditor: veto só por teste), principal `a95aade` (correção em `103c656`)

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| worker_c1_2 | correção do veto (opus) | — | .agents/worker_c1_2/handoff.md | só `base.test.mjs`: `elementosDoPainel` exige para bruno/davi o primeiro nível do `<main>` = `h1, section:indicadores, section:recursos, button`; título escapado dentro de `<li>` |
| auditor_c1_3 | general-purpose forense (opus) | **PASS** | .agents/auditor_c1_3/handoff.md, mutacoes.txt | as 5 do veto pegas e o controle verde; 14 variantes, 10 pegas; 4 vivas por contorno (A2: texto neutro dentro de uma seção, no layout ou no `h1`) → `DEFERRED.md` D30; regressão por família 18/18; falso vermelho com `title` no link de relatórios (observação) |

Gate Result: **PASS**. Fecha o **C1** (#10): a zona 1 embute o bloco de tarefas da zona 2 por fragmento (ADR-0011, adendo 1),
o shell recusa `_fragmento` do navegador, e a zona 2 fora ou travada apaga só o bloco. Estado ao fim: `task test` verde (stub 75,
shell 116), `task verificar` 119 + 4 pulados, `verificar:redis` 123/123, `verificar:estatica` 51/51, árvores limpas, portas
livres. Pastas dos verificadores e workers removidas depois do registro; última versão no commit `b091977`
(`git show b091977:.agents/<nome>/handoff.md`). Tag `gate-c1-aprovado`.

## Gate — D29 (núcleo 0.10.4: `ehHtmlInerte` por lista de permissão), iteração 1, principal `806c43c`, núcleo `50a0fea`, apps em 0.10.4 (`bbf6a84`)

Antes do gate (2026-10-07): `task test` verde (contratos 20, núcleo 286, moldura 26, stub 75, shell 116), `typecheck` ok,
`verificar:estatica` 51/51, `verificar:redis` 123/123, `verificar:construir` 119 + 4 pulados, `verificar:oidc` 6/6,
`showcase:checar` ok, lockstep 0.10.4. Mutações M1–M13 do plano rodadas pelo worker e pegas (Task 1).

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| revisor_d29_1 | revisor-mfe (sonnet) | **APPROVE** | .agents/revisor_d29_1/handoff.md | sem crítico nem importante; 2 menores (U+202E e U+FEFF aceitos em texto e valor; `id="__next"` é variante do limite `id`/`class` do D30); suspeita de logout por GET descartada pelo orquestrador (`/api/auth/sair` só tem POST) |
| challenger_d29_1 | simulador-condicoes (sonnet) | **APPROVE** | .agents/challenger_d29_1/handoff.md | 24 fragmentos hostis por uma dona falsa (`ZONA2_URL`): o bloco some do painel da zona 1 em HTML e RSC; controle canônico aparece; dono real 200/204/404, 20 produtores hostis dão 500 sem corpo; `verificar:redis` 123/123; divergências: fragmento direto sem cookie dá 307 ao `/login` (não 204; anterior ao D29), BOM aceito como texto |
| auditor_d29_1 | general-purpose forense (opus) | **PASS** | .agents/auditor_d29_1/handoff.md, mutacoes.txt | 61 execuções (M1–M13 com variantes, 19 novas de boa-fé, 3 de integração), 51 pegas; 10 vivas, nenhuma defeito: 7 equivalentes (M4b, M13b, N3, N4c, N4d, N7, N11) e 3 que só aceitam menos ou lançam e recusam (N6a, N6c, N9); `dist` das zonas idêntico ao build do fonte limpo; fuzz de 600 mil fragmentos sem execução; árvores limpas |

Gate Result: **PASS** (iteração 1). Fecha o **D29**: o HTML de fragmento é validado por lista de permissão no núcleo 0.10.4, em
lockstep nas 4 apps (`02-zonas.md` §2.3, ADR-0011 adendo 2). Menores e o alcance maior do limite (a) do D30 em `DEFERRED.md` D30.
Pastas dos verificadores removidas depois do registro; última versão no commit `0be6033`
(`git show 0be6033:.agents/<nome>/handoff.md`). Tag `gate-d29-aprovado`.

## Gate: C3 (mapa de zonas vivo e gateway híbrido), iteração 1, principal `0ea05ec`, shell `0081185`, stub `2da6dcb`, zonas `ce8e015`, `f88cce7`, `73a2c19`

Antes do gate (2026-10-07): `task test` verde (contratos 20, núcleo 286, moldura 26, stub 83, shell 158), `typecheck` ok, `verificar:estatica` 52/52, `scripts:test` 29/29, `verificar:redis` 135/135, `verificar:construir` 130 mais 5 pulados, `verificar:oidc` 6/6, `showcase:checar` ok, lockstep 0.10.4. Mutações declaradas das Tasks 1 a 5 rodadas pelos workers e pegas.

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| revisor_c3_1 | revisor-mfe (sonnet) | **APPROVE** | .agents/revisor_c3_1/handoff.md | sem crítico nem importante; 4 menores (rota `/_gateway` sem marca de que veio do proxy; `*` do padrão de origem casa pontos; mapa vazio legítimo dá 503 para qualquer `/abc`; `01-operacao.md` cita `caseSensitiveRoutes`) |
| challenger_c3_1 | simulador-condicoes (sonnet) | **APPROVE** | .agents/challenger_c3_1/handoff.md | 66 grafias de `/_gateway` e 120 pedidos com cabeçalho forjado, nenhum alcança zona; registro hostil descartado pelo shell; origem hostil dentro dos padrões recebe o cookie opaco (risco aceito no ADR-0015); documento com zona travada recebe a página no teto; mapa com fonte fora segue o último bom; navegação real com RSC 200 (ponto aberto do ADR fechado); observações: sem teto total para gotejamento, fallback de RSC não executado, entrada descartada vira 404 |
| auditor_c3_1 | general-purpose forense (opus) | **VETO (só por teste)** | .agents/auditor_c3_1/handoff.md, mutacoes.txt | 59 mutações, 51 pegas (14 declaradas todas pegas; 5 ponta a ponta todas pegas); viva de boa-fé N06: `encontrar` com o prefixo estático sem a barra (`/zona1-staticx` casa a `zona1`), nenhum teste reprova; outras 7 vivas equivalentes ou sem impacto; regressão por família verde e árvores limpas |

Gate Result: **VETO (só por teste)**. Correção: teste em `test/mapa-zonas.test.mjs` para o prefixo estático com fronteira de segmento. Iteração 2: só um auditor novo (regra do humano, 2026-10-06).

## Gate: C3, iteração 2 (só auditor: veto só por teste), principal `4a6fc63`, shell `d52b5fc`

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| worker_c3_1 | correção do veto (sonnet) | — | .agents/worker_c3_1/handoff.md | só teste: prefixo estático com fronteira de segmento (`zona1` e `zona1-staticx`) e página de erro sem ecoar id hostil; N06 e N13 reprovam; shell 160/160 |
| auditor_c3_2 | general-purpose forense (opus) | **PASS** | .agents/auditor_c3_2/handoff.md, mutacoes.txt | correção só de teste confirmada; N06 e N13 pegas pelos testes novos; 21 mutações, 17 pegas, 4 vivas equivalentes (ordem de casamento e validação do `supportId` contra o id da zona, hoje sem chamador hostil); regressão por família verde (shell 160, stub 83, scripts 29, estática 52, `verificar:redis` 135/135); árvores limpas |

Gate Result: **PASS** (iteração 2). Fecha o **C3** (#14): zona nova entra registrando a própria rota no deploy, sem editar arquivo do shell nem reiniciá-lo; zona travada devolve ao documento a página da base com `supportId` dentro de `ERP_ZONA_TETO_MS` (fecha o D7). Menores e observações no `DEFERRED.md` D32; limites no D31. Pastas dos verificadores e do worker removidas depois do registro; última versão no commit `91fcefc` (`git show 91fcefc:.agents/<nome>/handoff.md`). Tag `gate-c3-aprovado`.


## Gate: E3, E4 e E5 (showcase nos dois modos, zona de demonstração, roteiro F1 a F7, `showcase:verificar`), iteração 1, principal `d625731`, shell `d6e48fc`

Antes do gate (2026-10-07): `task test` verde (contratos 20, moldura 26, stub 83, shell 161, núcleo 286), `typecheck` ok, `verificar:estatica` 52/52, `scripts:test` 29/29, lockstep 0.10.4, `showcase:checar` ok; `verificar:redis`, `verificar:oidc` e `showcase:verificar` nos dois modos rodando (orquestrador). Mutações declaradas das Tasks 1, 2 e 4 rodadas pelos workers e pegas (ledger `ledger/2026-10-07-e3-e4-e5-showcase/`).

| Agent | Role | Verdict | Source | Notes |
|-------|------|---------|--------|-------|
| revisor_e3e5_1 | revisor-mfe (sonnet) | em andamento | .agents/revisor_e3e5_1/handoff.md | despachado |
| challenger_e3e5_1 | simulador-condicoes (sonnet) | aguardando portas | .agents/challenger_e3e5_1/handoff.md | segue o roteiro inteiro nos dois modos |
| auditor_e3e5_1 | general-purpose forense (opus) | aguardando challenger | .agents/auditor_e3e5_1/handoff.md | tabelas de mutação das Tasks 1, 2 e 4 |
