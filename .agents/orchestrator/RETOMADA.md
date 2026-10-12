# Retomada P1 2026-10-12

Retomada autorizada pelo humano. Worker executou os passos técnicos; fechamento e commits do principal bloqueados por `.agents/` e `.git/` montados somente leitura (EROFS), não por revisão automática. As propostas de atualização estão neste relatório para aplicação pelo orquestrador.

P1 operacional permanece aberto: registro oficial, política de imutabilidade, tarballs canônicos, reconciliação de integridades e CI remoto pendentes. Sem push, publicação externa ou alteração de configuração global. Lockfiles de moldura/stub preservados; diff no relatório.

Autenticação pnpm 12.5.1 corrigida para --userconfig: matriz HTTP real com 10 combinações (6 sucessos, 4 recusas esperadas), instalação real congelada e specifier divergente cobertos. Arquivo 0600 e finally mantidos, token fora dos argumentos.

Falha temporal do núcleo investigada: 5× isolado e 3× CPU concorrente passaram; bloqueio do event loop reproduziu os 1231 ms nos três stores. Mudança só no teste: limite superior passa a relógio controlado; teto exato 300 ms, IdP uma vez e sessão intacta. Mutações antes/depois do teto pegas. Produto e versão 0.10.4 intactos.

M1–M10 pegas em cópia isolada, baselines verdes, zero sobreviventes. Executor M3 seleciona só verificar(). Regressão descobriu browser Docker sem aba: about:blank explícito corrigiu; mutação adicional pega pelo autoteste real.

Regressão até aqui: unidades 579/0/0; estática 52/0/0; scripts 52/0/0 (pass/fail/skip). Lockstep passou nas quatro apps. Arquivo 130/0/5; Redis 135/0/0. OIDC 6/0/0; showcase dev 7/0/0 e OIDC 7/0/0. Gate independente não refeito; nenhum gate aprovado nesta rodada.

Logs: /tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/c3ace712-bc26-43d0-aa52-376d9e480ce4/scratchpad/codex/. Scripts essenciais preparados em base/scripts/, com tarefas no Taskfile. Evidências persistentes em docs/superpowers/reports/2026-10-12-p1-retomada/.

Cleanup pendente no host: filho próprio antigo do autoteste 21272 (pai 21265, porta 36819); o outro filho encerrou ao vencer o timeout; kernel negou SIGTERM na sessão isolada. Conferir os pares antes de encerrar. O registro que apareceu em 4873 é alheio e não foi administrado. Demais portas da base: consultar snapshot final.

Próximo: liberar escrita de .agents/ e .git/ do principal; aplicar estes documentos; teste do núcleo já commitado em df5b0f4; commitar principal fixando o submódulo, por passo, com Co-Authored-By: Codex <noreply@openai.com>. Não incluir lockfiles preexistentes. Repetir/revisar o gate com verificadores novos; envio remoto fora deste escopo.
