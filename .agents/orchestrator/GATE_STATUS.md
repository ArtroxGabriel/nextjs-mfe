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
