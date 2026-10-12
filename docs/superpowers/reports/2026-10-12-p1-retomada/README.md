# Retomada P1 — 2026-10-12 (worker; registro bloqueado)

Retomada autorizada pelo humano. Os passos técnicos foram executados e as famílias finais locais passaram. Gate independente e P1 operacional continuam abertos. Sem push, publicação externa ou configuração global alterada; nenhuma leitura/escrita no diretório do projeto vizinho. Apenas processos próprios receberam sinais. O registro que apareceu na porta 4873 não foi administrado.

O núcleo tem Git próprio e gravável: commit `df5b0f4`, `test(identity): verify renewal deadline with a controlled clock`. Principal e `.agents/` estão montados somente leitura: `git add` falha no `.git/index.lock` e `task orquestrador:ledger` falha com EROFS. O orquestrador aplicou as propostas em `.agents/orchestrator/` e commitou o principal.

## Por passo

1. Sonda pnpm 12.5.1, mock HTTP loopback exigindo Bearer fictício, fixture somente `@erp/fixture`: 10 combinações executadas. Camel/kebab não enviam Authorization em view/install (4 recusas esperadas); --userconfig, npm_config_userconfig e .npmrc enviam em ambos (6 sucessos). Matriz bruta em auth-matriz.json. Instalador corrigido para --userconfig, mantendo token fora dos argumentos, arquivo 0600 e remoção em finally. Novo teste usa instalação real congelada, baixa o tarball com Authorization e recusa specifier divergente sem reescrever lock. Passo 1 inicialmente 10 pass/0 fail/0 skip. Lockfiles pendentes de moldura/stub preservados; diff anexado, sem escolhê-los como canônicos.
2. Teste antigo: cinco rodadas isoladas (15 pass/0 fail/0 skip) e três com quatro processos próprios concorrendo numa CPU (9 pass/0 fail/0 skip). Bloqueio síncrono de 1200 ms no event loop, em cópia, reproduziu 0 pass/3 fail/0 skip, cerca de 1231 ms. Produto usa deadline absoluto e corta o último passo; escalonamento e store não têm teto de relógio real. Mudança só no teste: limite inferior e checks de IdP/sessão dos três stores mantidos; prova controlada exige retorno exato em 300 ms, IdP uma vez e sessão intacta. Import ESM de timers/promises exige syncBuiltinESMExports ao ligar/restaurar os mocks. Primeiro protótipo sem isso: 3 pass/1 fail/0 skip; corrigido e regressão do núcleo 287 pass/0 fail/0 skip. Baseline determinística 1 pass/0 fail/0 skip; mutações de retorno antes/depois do teto: 0 pass/1 fail/0 skip cada, em cópia. Teste corrigido sob o bloqueio: 3 pass/0 fail/0 skip. Produto/versão 0.10.4 intactos, sem publicação ou lockstep novo.
3. Executor preparado em base/scripts/mutacoes-p1.mjs; M3 seleciona só a guarda de verificar(). Um teste preserva a confirmação de publicar(). Todas M1–M10 pegas em cópia, nenhuma sobrevivente; baselines verdes antes das mutações. M6 também pega a retirada do congelamento com pnpm real. Logs M*.txt e JSON com resultado/testes/contagens anexados.
4. Todas as famílias solicitadas rodaram, incluindo Redis, OIDC e showcase nos dois modos. Portas conferidas por ss antes de subir; Docker 29.8.2 disponível. Resultados finais na tabela abaixo. Regressão descobriu ferramenta Docker sem aba: about:blank explícito corrigiu; baseline real 1 pass/0 fail/0 skip e mutação sem aba 0 pass/1 fail/0 skip. A correção não muda arquitetura/autorização do produto.
5. Plano revisado sem marcar tasks concluídas. RETOMADA, ledger, GATE_STATUS, ATIVIDADES e AMBIENTE completos preparados em orquestrador/. Progress também em .superpowers/sdd/2026-10-09-p1-registro-e-ci/. Aplicação canônica e commits do principal bloqueados por EROFS. Nenhuma aprovação de gate registrada.

## Contagens brutas finais

| Família | pass | fail | skip | Log no scratchpad/codex/ |
|---|---:|---:|---:|---|
| task test | 579 | 0 | 0 | regressao-unidades.log |
| estática | 52 | 0 | 0 | regressao-estatica.log |
| scripts | 52 | 0 | 0 | regressao-scripts-final.log |
| task verificar:construir (arquivo, Chrome Docker) | 130 | 0 | 5 | regressao-arquivo-corrigido.log |
| Redis | 135 | 0 | 0 | regressao-redis.log |
| OIDC | 6 | 0 | 0 | regressao-oidc.log |
| showcase dev | 7 | 0 | 0 | showcase-dev-test.log |
| showcase OIDC | 7 | 0 | 0 | showcase-oidc-test.log |

Unidades: contratos 20, núcleo 287, moldura 26, stub 83, shell 163; zonas sem script de teste. Cinco skips do arquivo são exclusivos de Redis, todos passaram no modo Redis. Lockstep terminou 0, núcleo 0.10.4 nas quatro apps; não emite pass/fail/skip. Checagem Keycloak após OIDC terminou 0 (padrão de vida do token restaurado, PKCE, rotação e força bruta); também não emite contagem de casos. JSON de contagens anexado.

Tentativas anteriores, sem aprovação: scripts 51 pass/1 fail/0 skip por sintaxe no teste novo, corrigida e repetida; primeira integração Flatpak interrompida observou 71 pass/2 fail/6 skip sem resumo final (EROFS no perfil); segunda integração Docker sem aba terminou por timeout, 136 testes/127 pass/3 fail/5 skip/1 cancelado. Tentativa NODE_OPTIONS=--test-force-exit foi recusada antes dos testes; flag usada somente na prova isolada por argumento CLI. Logs preservados, sem canalizar para head.

| Mutação | Teste que pegou |
|---|---|
| M1 | versão existente não chega ao build/publish |
| M2 | 401/500 não chegam ao build/publish |
| M3 | hash divergente impede instalar e preserva lock/node_modules |
| M4 | redirect não é seguido nem recebe token no destino |
| M5 | registro externo exige HTTPS |
| M6 | instalação congelada, inclusive pnpm real recusando specifier divergente |
| M7 | publicação usa bytes preparados, destino e commit corretos |
| M8 | scripts de produção sem identidade dev implícita |
| M9 | guarda de produção exige IdP ou autorização explícita |
| M10 | lockstep recusa núcleo sem resolução no lockfile |

Falhas em M1–M10 são esperadas: cada mutação deve reprovar. Não são regressão quebrada. Nenhuma sobreviveu.

## Recursos e pendências

Redis b778d2396a57 e Keycloak b62d622d3cb5 foram criados/iniciados pelo worker e parados pelos IDs ao terminar. Showcase apps/domínios encerrados pelo executor. Snapshot final confirma livres 3000–3003, 3009, 4001–4004, 4010, 4020, 6379 e 8080.

Uma falha de abertura do browser antes do try do autoteste deixou filho Node com servidor aberto. Ctrl-C do task não o encerrou, e o kernel recusou SIGTERM via container com o mesmo uid, sem CAP adicional. **Resta o filho próprio 21272, pai 21265, porta 36819; o orquestrador precisa conferir os pares no host e encerrar esse filho.** A segunda ocorrência (26210/26203, porta 33347) encerrou ao vencer o timeout. Identidades, tentativa de limpeza e snapshot anexados. Nenhum processo alheio foi encerrado.

O orquestrador precisa liberar escrita de .agents/ e .git/ do principal, aplicar os documentos propostos e criar os commits por passo fixando o núcleo já commitado; preservar os dois lockfiles pendentes. Depois, revisão/gate novos. P1 operacional ainda depende de registro oficial, política de imutabilidade, tarballs canônicos, integridades reconciliadas e CI remoto. Não houve pesquisa externa ou necessidade de alterar a decisão 5 do ADR-0016.

Decisões do worker: --userconfig escolhido pela evidência HTTP; limite superior de relógio real substituído por relógio controlado após contraprova; about:blank corrigido após prova de ausência de aba. Todas têm teste comportamental e mutação correspondente, sem decisão estrutural nova.

Logs completos: `/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/c3ace712-bc26-43d0-aa52-376d9e480ce4/scratchpad/codex/`. Scripts essenciais preparados para versionamento em base/scripts/ com entradas no Taskfile; script de tentativa de limpeza preservado neste relatório. Nenhum script essencial depende de arquivo perdido de /tmp.
