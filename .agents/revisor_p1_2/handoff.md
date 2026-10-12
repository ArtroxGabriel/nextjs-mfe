# revisor_p1_2 (final)

Escopo: revisão por leitura de 958c4a8..eab0e38 (dc4922a e eab0e38), shell bd51363 e núcleo df5b0f4. Sem serviços, portas, alterações de produto, configuração global, git ou publicação. Escrita somente neste scratchpad. Nenhum acesso ao projeto proibido ou ação sobre processos.

Etapa 1: instruções do revisor, AGENTS.md, LEIA-PRIMEIRO.md e CODEX.md lidos. HEAD corresponde ao escopo. Estado observado: alterações preexistentes nos submódulos moldura e domínio-stub, fora desta revisão.

Veredito pendente. Ainda sem achados confirmados.

Etapa 2: lidos RETOMADA.md, AMBIENTE.md, ADR-0016, plano P1, relatório da retomada e handoffs da primeira iteração. Lidos também desenho do núcleo e ADRs 0008/0009. Diff principal e commits dos dois submódulos conferidos.

Constatações por leitura: pnpm agora recebe --userconfig com caminho, sem token no argv; auth.ini nasce 0600 dentro de diretório temporário privado e é removido no finally de execução. Tokens conhecidos são retirados do ambiente dos filhos. Consulta de metadata não segue redirect nem imprime resposta. Workflows separam leitura de publicação e não usam pull_request_target. D18 passa por instrumentation/register e conferirNaSubida; build/start não autorizam dev. Núcleo mantém testes reais dos três stores e acrescenta relógio controlado para o algoritmo comum.

Em investigação: necessidade dos scripts específicos da retomada e dos anexos de máquina; condições efetivas de publicação no workflow; garantias exatas do teste controlado. Nenhum teste, serviço ou mutação executado por este revisor.

Etapa 3: conferidos todos os scripts novos, suas referências no Taskfile, dependências de fixture e lógica de mutações, bem como instrumentation/subida e o algoritmo comum de espera. Todos os comandos novos de rotina têm desc no Taskfile; fixture e testes entram pelas tarefas que os consomem.

Achado confirmado em análise por leitura: pacotes.mjs verifica árvore Git limpa, mas copia dist após build sem limpar a saída. Os três pacotes ignoram dist e seus builds tsc não apagam saídas antigas. Há evidência atual do cenário: contratos/dist/pedido.js e pedido.d.ts existem, mas não há contratos/src/pedido.ts. Esses arquivos entram na cópia recursiva e no files: [dist] do manifesto, apesar de não corresponderem ao commit registrado. Correção: construir saída limpa antes do empacotamento, preferencialmente em checkout temporário do commit, com teste que plante saída órfã e confira sua ausência no artefato preparado.

Material descartável confirmado no relatório: cleanup-sondas-bloqueada.sh administra host via Docker e guarda caminho absoluto da estação, além de logs de PIDs, sockets e bloqueios de montagem. Contraria a orientação de manter logs e scripts de mutação/sonda no scratchpad. Avaliação de escopo e achados finais pendente. Nenhuma ação sobre os processos citados.

Etapa 4: conferência final de segurança e escopo. Busca nos arquivos alterados por formatos de JWT, tokens GitHub e npm não encontrou correspondências; nenhum valor de credencial foi salvo neste handoff. A busca não certifica a ausência de qualquer formato possível de segredo. Estado Git permanece igual ao início, com alterações preexistentes somente em moldura e stub; shell e núcleo sem alterações.

Publicação no workflow está subordinada à verificação reutilizável e só permite os branches declarados. Leitura é limitada ao passo de instalação; escrita somente ao passo de publicação, removida do ambiente dos filhos de build. A publicação exige consumidores ainda nas versões publicadas, conforme o documento. Não foi encontrado ciclo inevitável entre publicar e instalar nessas condições. Registro, artefatos canônicos e CI remoto permanecem requisitos de ativação, explicitamente pendentes.

D18: ligação de execução correta por leitura. Os testes novos chamam verificarConfiguracaoDoShell diretamente e verificam build/start; não constituem uma prova de next start efetivamente encerrando na subida. Esta revisão não executou essa prova e não confirma eventual resultado do challenger.

Relógio controlado: syncBuiltinESMExports sincroniza o import de timers/promises com os mocks e o finally restaura ambos. Há asserções de não retorno em cada passo até 280 ms, retorno em 300 ms, estado em-andamento, IdP uma vez e sessão mantida. A garantia observada é do algoritmo comum com store imediato, espera 300 e passo 20; não é prazo de escalonamento/store em produção. Os três stores reais/falsos continuam testando concorrência e preservação da sessão. A alteração mantém essa garantia. Não executei as mutações declaradas.


## Veredito final

**REPROVA.** Revisão por leitura da implementação no escopo definido. Não certifica execução de testes, mutações, serviços ou CI remoto. Não há vazamento de credencial confirmado. Os dois achados abaixo precisam de correção antes da aprovação deste revisor.

### 1. P2, integridade de publicação: dist antigo entra no artefato com commit de origem incorreto

- Arquivo e linha: `base/scripts/pacotes.mjs:137`, com a cópia recursiva em `:141`.
- Defeito: a publicação confia na árvore Git limpa, constrói sobre um `dist` preexistente e copia toda essa saída, inclusive arquivos ignorados que o commit já não produz.
- Cenário concreto: um arquivo de fonte foi removido num commit, mas seu `.js` e `.d.ts` ficaram no `dist`. Os builds dos três pacotes usam `tsc` sem limpar a saída, e os três `.gitignore` ignoram `dist`. `git status --porcelain` continua vazio. O manifesto mantém `files: ["dist"]`, então a cópia recursiva permite publicar essas saídas antigas sob `erpOrigem.commit` do commit novo. O checkout atual já contém o estado que permite isso: `repos/erp-contratos/dist/pedido.js` e `pedido.d.ts` existem, enquanto `git ls-tree HEAD -- src` desse pacote contém só `acesso.ts`, `erros.ts` e `index.ts`. Não empacotei nem publiquei para demonstrar o resultado.
- Consequência: o novo publicador pode consolidar num registro imutável conteúdo que não corresponde à origem declarada. A conferência final do hash confirma os mesmos bytes contaminados e não detecta o problema.
- Correção concreta: limpar a saída de build antes de construir e empacotar, ou construir em checkout temporário do commit com saída nova. Acrescentar teste que coloque arquivo órfão em dist, simule a geração dos arquivos válidos e confira que o conteúdo preparado para npm pack não contém o órfão. Não alterar hashes nem republicar versão existente para reparar isso.

### 2. P2, escopo: scripts e resíduos descartáveis da sessão foram promovidos ao repositório

- Arquivo e linha principal: `docs/superpowers/reports/2026-10-12-p1-retomada/README.md:57`.
- Evidências adicionais: `docs/superpowers/reports/2026-10-12-p1-retomada/cleanup-sondas-bloqueada.sh:6`, `base/scripts/investigar-espera-p1.mjs:17`, `base/scripts/provar-browser-p1.mjs:13`, `base/scripts/provar-espera-p1.mjs:16` e `Taskfile.yml:57`.
- Defeito: o relatório preserva script de limpeza com Docker no namespace de processos do host, caminho absoluto da estação, snapshots de PIDs/portas, bloqueios de montagem e logs brutos; sete dos nove novos scripts são sondas, executores ou provas particulares do gate, não dependências da instalação nem dos testes funcionais de produto.
- Consequência concreta: a retomada passou a adicionar uma superfície permanente de manutenção e administração de máquina ao checkout e ao catálogo de tarefas, embora as receitas de mutação e os resultados relevantes já tenham lugar no plano/ledger. O script de limpeza preservado em docs pode ser reaplicado fora da sessão que tinha a propriedade dos processos; não deve sobreviver como ferramenta operacional versionada. Não executei esse script nem consultei os processos citados.
- Regra aplicável: `.agents/orchestrator/LEIA-PRIMEIRO.md:21` registra a regra humana de só o necessário; `.agents/orchestrator/AMBIENTE.md:118` manda deixar logs e scripts de mutação no scratchpad.
- Correção concreta: conservar a ferramenta de pacotes, seus testes, o teste real de autenticação e sua fixture, ADR, plano e documentação operacional. Transferir os scripts de sonda/prova/mutação particulares desta rodada e os anexos de máquina ao scratchpad, remover suas entradas específicas do Taskfile e ajustar a referência à sonda em `docs/REGISTRO-E-CI.md:11`. Reduzir o relatório a um resumo verificável com contagens, matriz de mutações e decisões necessárias, sem script de limpeza, PIDs, sockets ou falhas de montagem transitórias. As tarefas permanentes que sobrarem continuam com desc.

## Avaliação individual dos nove scripts novos da retomada

| Arquivo em base/scripts | Necessidade no checkout permanente | Encaminhamento |
|---|---|---|
| `pnpm-auth-fixture.mjs` | Sim: dependência do teste real de autenticação | Manter |
| `pnpm-auth.test.mjs` | Sim: prova Authorization e instalação congelada com pnpm real | Manter, por scripts:test |
| `sondar-auth-pnpm.mjs` | Diagnóstico comparativo da falha já corrigida | Scratchpad; resultado relevante resumido no relatório |
| `investigar-espera-p1.mjs` | Investigação temporal, carga própria e contraprova particulares desta sessão | Scratchpad |
| `provar-espera-p1.mjs` | Executor de mutações do gate; o teste permanente está no núcleo | Scratchpad; receita no plano/ledger |
| `provar-browser-p1.mjs` | Executor de mutação do gate; o autoteste permanente já existe | Scratchpad; receita no plano/ledger |
| `verificar-showcases-p1.mjs` | Orquestra a rodada particular; tarefas permanentes de showcase já existem | Scratchpad |
| `mutacoes-p1.mjs` | Executor particular da tabela M1 a M10 do gate | Scratchpad; tabela e evidência resumida no plano/ledger |
| `mutacoes-p1.test.mjs` | Só testa a transformação do executor particular M3 | Acompanhar o executor no scratchpad |

Os seis comandos adicionados para sondas/executores têm desc no Taskfile. Fixture e testes são chamados pelas tarefas consumidoras. Portanto o achado não é ausência de desc, mas necessidade de conservar essas rotinas no repositório.

## Pontos conferidos sem achado bloqueador

- Invariantes: sem alteração de DTO/ilha, ações, permissões, destinos de negócio, cache protegido ou autoridade de sessão no diff. A alteração de produto do shell é a validação D18.
- Credencial: --userconfig contém somente o caminho do auth.ini. Arquivo 0600 dentro de diretório privado gerado por mkdtemp; cleanup no finally em sucesso/falha da execução. Nenhum token nos argumentos. As variáveis conhecidas de token são excluídas dos ambientes de instalação/build/pack/publish. Consultas HTTP usam redirect manual, timeout e erros sem corpo do registro. O CLI não imprime stack/argv de erro do subprocesso. Os testes cobrem arquivo, argumentos, ambiente e limpeza; a prova real exercita Authorization no download.
- Workflows: checkout com submódulos fixados; contents: read; persist-credentials: false; publicação manual serializada e dependente da verificação; entrada fechada de pacote; nenhum pull_request_target; tokens de leitura e escrita separados por etapa. CI remoto e registro oficial continuam explicitamente pendentes.
- D18: build/start não definem autorização dev; produção sem emissor válido ou autorização exata é recusada pela guarda. Por leitura, instrumentation.register chama conferirNaSubida, que chama a guarda e sai em erro. O teste novo prova a guarda, não a inicialização completa do Next; a prova operacional da subida cabe ao challenger, sem uso de portas por este revisor.
- Núcleo: commit df5b0f4 muda somente teste. O relógio controlado prova o prazo algorítmico para a configuração 300/20 e preserva IdP único/sessão. Não promete tempo real máximo de I/O ou escalonamento. Os cenários dos três stores e o limite inferior real continuam. Não houve enfraquecimento confirmado dessa garantia no escopo revisado.
- Navegador: about:blank torna explícita a aba inicial no ramo Docker, conforme já fazia o ramo local. A prova de execução/mutação existente foi lida, não reexecutada.

## Encerramento e limites

Todas as leituras ficaram na base MFE e nas ferramentas locais pertinentes; nenhuma leitura ou escrita no projeto proibido. Nenhum serviço, porta, contêiner, teste ou mutação iniciado. Nenhum processo recebeu sinal. PIDs indicados pelo usuário foram ignorados. Nenhum produto, configuração global, git, .agents ou .git alterado; nenhuma publicação ou push. Escrita somente neste handoff do scratchpad autorizado. Estado Git ao terminar igual ao observado no início.
