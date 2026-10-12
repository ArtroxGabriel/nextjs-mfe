# P1: correção da iteração 2 em 2026-10-12

Worker p1_3 concluiu as correções locais. Gate da iteração 2 permanece REPROVA até nova revisão independente. P1 operacional segue aberto: registro oficial, imutabilidade do serviço, migração dos tarballs canônicos, reconciliação de integridades e CI remoto pendentes.

Publicação limpa integralmente dist antes do build. npm pack real comprova que .js e .d.ts órfãos não entram no tarball. Mantém o checkout e suas dependências instaladas; não houve publicação externa nem republicação.

Install e publish usam filhos assíncronos controlados. SIGINT/SIGTERM apagam temporários sincronamente antes de aguardar os grupos próprios; após ERP_NPM_ENCERRAMENTO_MS, SIGKILL. exit tem cleanup síncrono. Quatro interrupções reais passaram; saída explícita e filho resistente também. SIGKILL no controlador e queda da máquina não executam cleanup.

Redirect de metadata é recusado. pnpm 12.5.1 segue redirect de tarball, sem opção pública de recusa identificada. Testes entre origens distintas em loopback: zero Authorization no destino, bytes canônicos aceitos, bytes adulterados recusados por integridade, lock preservado. Limite em docs/REGISTRO-E-CI.md; proposta D34 em DEFERRED.md do scratchpad. Registro oficial deve servir bytes diretamente. Challenger observou Ready antes da recusa do shell sem IdP, sem servir HTTP; observação registrada, shell intacto.

Relatório de máquina e sete scripts particulares saíram do checkout. Evidência anterior e executores preservados somente em /tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/c3ace712-bc26-43d0-aa52-376d9e480ce4/scratchpad/codex/worker_p1_3. Justificativa de cada script restante em handoff.md.

Scripts 60 pass, 0 fail, 0 skip; estática 52 pass, 0 fail, 0 skip; lockstep 0.10.4 nas quatro apps, saída 0. Nenhum submódulo alterado, portanto task test não foi repetido nesta correção.
M1 a M14 detectadas em cópia isolada, zero sobreviventes. Baselines: 43 pass, 0 fail, 0 skip. Execuções com mutações: 123 testes, 103 pass, 20 falhas esperadas, 0 skip, 0 cancelled.

Nenhum commit criado, pois só o principal mudou e .git/.agents são somente leitura para o worker. Os lockfiles soltos de moldura e stub foram preservados; nenhum push ou configuração global. Processos alheios e os dois órfãos antigos foram ignorados.

Próximo passo do orquestrador: aplicar as propostas RETOMADA, GATE_STATUS, ATIVIDADES, progress e DEFERRED deste scratchpad, corrigir referências antigas ao relatório removido, commitar os arquivos listados em arquivos-principal.txt com mensagem em inglês sem coautoria e iniciar novo gate. Sugestão: fix(packages): clean build output and credentials on interruption. Não incluir os lockfiles preexistentes.
