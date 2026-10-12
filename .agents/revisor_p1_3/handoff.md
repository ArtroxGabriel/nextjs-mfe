# revisor_p1_3 (final)

**Veredito: APROVA por leitura a implementação no escopo do gate P1, iteração 3.** Nenhum novo defeito concreto bloqueador confirmado. Não equivale a concluir P1 operacional nem certifica execução independente de testes, mutações ou CI remoto.

## Escopo e método

Principal: `git diff 958c4a8..HEAD`, HEAD `dde6957`, incluindo dc4922a, eab0e38 e a correção dde6957. O intervalo também contém 10942e4, que registra os handoffs da iteração 2. Shell fixado em bd513635d09202548cc3bd3b5793c68ac246a135; núcleo fixado em df5b0f453f6e212242e7d92648d2a52281c54c17, somente teste.

Segui .claude/agents/revisor-mfe.md. Li AGENTS.md, LEIA-PRIMEIRO.md, CODEX.md, RETOMADA.md, AMBIENTE.md, desenho do núcleo, ADRs 0008/0009/0016, plano P1 e os handoffs de revisor_p1_1, challenger_p1_1, revisor_p1_2 e challenger_p1_2. Conferi o diff, arquivos completos relevantes, Taskfile, workflows, documentos operacionais, D34, ledger e evidência do worker p1_3 no scratchpad.

O handoff nasceu com '(parcial)' antes da leitura do diff e foi atualizado após instruções, publicador/testes e workflows/submódulos. Este texto substitui o rascunho ao concluir a revisão.

## Achados atuais, por severidade

Nenhum achado novo confirmado que reprove o escopo. As classificações históricas abaixo são preservadas; o redirect de tarball continua sem recusa pelo downloader e está declarado com evidência e condição de ativação.

## Conferência individual dos achados anteriores

| Origem e classificação original | Estado nesta revisão | Evidência e correção conferidas |
|---|---|---|
| challenger_p1_2 A1, alta: SIGINT deixa token no disco | Corrigido por leitura, com prova permanente e resultados registrados | pacotes.mjs:107 remove temporários sincronamente; :124 faz isso antes de await; :126 encerra grupos próprios; :130 aguarda close; :115 cobre exit. pacotes-processos.test.mjs:45 cobre install/publish com SIGINT/SIGTERM, :102 cobre exit e :118 cobre filho resistente, segundo sinal e teto. Worker registra quatro interrupções e casos adicionais verdes; M12/M13/M14 detectadas. |
| revisor_p1_2, P2: dist antigo entra no tarball com commit incorreto | Corrigido | pacotes.mjs:225 remove integralmente dist antes do build. pacotes.test.mjs:177 planta órfãos .js/.d.ts, usa npm pack real e inspeciona membros do tarball; :198 exige ausência dos órfãos. M11 detectada por essa asserção. Configurações atuais dos três pacotes não usam compilação incremental que dispense regenerar a saída removida. |
| revisor_p1_2, P2: scripts e resíduos descartáveis versionados | Corrigido | dde6957 remove os sete scripts particulares, suas seis tarefas e todos os 41 arquivos do relatório de máquina, inclusive o script de limpeza. A referência operacional à sonda sai de REGISTRO-E-CI. Resultados essenciais ficam no plano/ledger/GATE_STATUS; evidência anterior e executores ficam no scratchpad. |
| challenger_p1_2 A2, média: pnpm segue redirect de tarball | Permanece como limite declarado, sem alegação de correção nem reclassificação | REGISTRO-E-CI.md:15 e DEFERRED.md:231 (D34) distinguem metadata e download. pnpm-auth.test.mjs:47 testa pnpm real entre duas origens de loopback: destino sem Authorization, bytes canônicos aceitos e adulteração recusada por integrity, lock idêntico. Plano M4 cobre somente metadata. Registro oficial deve servir tarballs diretamente, com a propriedade verificada na ativação. |
| challenger_p1_1: view com npmrcAuthFile recebeu 401; install ainda não comprovado | Corrigido e comprovado nos registros posteriores | pacotes.mjs:199 usa --userconfig com caminho. pnpm-auth.test.mjs:8 chama instalar real e exige download autenticado e lock congelado. challenger_p1_2 registra duas execuções de view/install com código 0 e pedidos autenticados. |
| Pendência histórica M3: marcador ambíguo impediu aplicar a mutação | Resolvida na evidência posterior | Ledger e resultados.json do worker registram M3 detectada pelo teste de hash divergente; 9 pass, 1 falha esperada, 0 skip. Não reapliquei a mutação. |
| Observação histórica de teto temporal do núcleo | Tratada sem alteração do produto | df5b0f4 acrescenta prova determinística do algoritmo e conserva os cenários dos três stores. Detalhes abaixo. |
| Observação de Ready antes da recusa D18 | Declarada, sem nova classificação | REGISTRO-E-CI.md:63 preserva o resultado do challenger: saída 1, nenhuma resposta HTTP nas sondas recusadas. O anúncio Ready não é tratado como disponibilidade. |

revisor_p1_1 não tinha achado bloqueador e já limitava sua aprovação à leitura. Pendências externas que ele registrou continuam abertas.

## Credencial, publicação e invariantes

--userconfig passa somente o caminho de auth.ini no argv, em instalação e publicação. O arquivo nasce com modo 0600 em diretório privado de mkdtemp. Tokens conhecidos ERP_NPM_TOKEN, ERP_NPM_TOKEN_PUBLICACAO, NODE_AUTH_TOKEN e NPM_TOKEN são retirados do ambiente dos filhos; o token de escrita não acompanha build/pack. O manifesto preparado remove lifecycle scripts, fixa o registro validado e registra o commit. Há preflight de ausência, árvore limpa, segunda consulta antes de publicar e confirmação de integrity/commit depois.

Metadata usa redirect manual e timeout, sem imprimir corpo da resposta. O CLI não imprime stack ou argv de subprocesso. Os testes verificam ausência de token nos argumentos/ambiente e nas saídas dos processos interrompidos. Nenhum vazamento novo confirmado por leitura; isso não prova ausência em toda combinação de registro, downloader ou log externo.

Cleanup cobre sucesso, falha, SIGINT, SIGTERM e exit. O controlador sinaliza grupos de filhos que ele próprio iniciou, sem descoberta de PID no host. ERP_NPM_ENCERRAMENTO_MS é validado e documentado em CONFIGURACAO.md:139. SIGKILL no controlador e queda da máquina não executam cleanup, limite explicitamente documentado.

Não há alteração de DTO sensível, ilha cliente, Server Action, autorização do domínio, destino de negócio, cache protegido ou autoridade de sessão. O publicador é ferramenta fora do Next, não endpoint do BFF. A mudança de produto do shell é a guarda D18; o núcleo altera somente teste. Nenhum novo rompimento dos invariantes confirmado.

## Workflows e tarefas

verificar.yml:26 faz checkout recursivo dos commits fixados, fetch-depth 0 e persist-credentials false. A permissão é contents: read. Leitura de registro existe somente na instalação; verificação chama ci:verificar e ponta a ponta em arquivo. Redis/OIDC/showcase e ausência de execução remota estão declarados.

publicar-pacotes.yml:21 restringe os branches declarados; :28 depende da verificação reutilizável. Publicação é manual, com entrada de pacote fechada e concorrência serializada. Tokens de leitura e escrita ficam em passos distintos; escrita só em :56. Não há pull_request_target. A imutabilidade atômica continua sendo responsabilidade do registro, como no ADR.

As rotinas de publicação, preflight, migração, instalação e CI têm desc no Taskfile. scripts:test:157 também tem desc e glob explícito, consumindo todos os testes permanentes. Fixture não precisa de entrada CLI própria. O fluxo documenta consumidores mantidos nas versões já publicadas até o pacote novo existir; nessas condições não há ciclo inevitável entre verificação e publicação.

## D18 e relógio controlado

D18: shell/lib/configuracao.ts:112 recusa produção sem emissor não branco e sem autorização exata '1'. build/start não injetam autorização dev. instrumentation.register chama conferirNaSubida, que executa a guarda e sai 1 em erro. O teste unitário chama a guarda diretamente; a prova de next start foi registrada pelo challenger anterior e não foi repetida aqui. A autorização explícita das ferramentas locais continua presente.

Núcleo: identidade.test.mjs:653 ativa Date/setTimeout simulados e sincroniza os imports ESM de node:timers/promises por syncBuiltinESMExports. finally restaura timers e imports. O teste exige não retorno nos passos até 280 ms, retorno em 300 ms com store imediato, estado em-andamento, IdP uma vez, sessão mantida e número limitado de leituras. O algoritmo comum em fabricas/criarNucleo.ts:260 continua relendo o store com pausa limitada ao restante do prazo. Os três stores conservam concorrência, limite inferior real, estados e preservação da sessão.

A garantia é do teto algorítmico para 300/20 com store imediato. Não é prazo máximo de I/O ou escalonamento em produção. Não confirmei enfraquecimento dessa garantia. O produto do núcleo permanece intacto.

## Necessidade dos nove scripts e do relatório

| Arquivo original | Resultado conferido |
|---|---|
| pnpm-auth-fixture.mjs | Mantido: dependência das provas permanentes de autenticação, redirect e interrupção |
| pnpm-auth.test.mjs | Mantido: regressão permanente de pnpm real, Authorization, instalação congelada e integridade |
| sondar-auth-pnpm.mjs | Removido do checkout; diagnóstico particular preservado no scratchpad |
| investigar-espera-p1.mjs | Removido; investigação particular |
| provar-espera-p1.mjs | Removido; executor de mutações, teste permanente no núcleo |
| provar-browser-p1.mjs | Removido; executor particular, autoteste permanente existente |
| verificar-showcases-p1.mjs | Removido; tarefas operacionais de showcase já existem |
| mutacoes-p1.mjs | Removido; tabela e resultado permanecem no plano/ledger |
| mutacoes-p1.test.mjs | Removido junto com seu executor particular |

O relatório inteiro saiu de docs. Seu resumo necessário ficou no plano, ledger e estado do gate. pacotes.mjs e seus dois arquivos de testes são necessários para operação e regressão dos defeitos corrigidos; todos entram pelas tarefas com desc.

## Evidência consultada e limites

Li handoff.md, contagens.json e mutacoes-finais/resultados.json do worker p1_3 no scratchpad. Registram scripts 60/0/0, estática 52/0/0, lockstep 0.10.4 nas quatro apps e M1 a M14 detectadas, zero sobreviventes. As execuções mutadas registram 123 testes, 103 pass e 20 falhas deliberadas. Esses resultados são do worker, não execuções deste revisor nem auditoria forense independente.

Busquei padrões de JWT, tokens GitHub e npm nos 31 arquivos regulares alterados: zero correspondências. Nenhum valor de credencial foi salvo neste handoff. A busca não cobre todos os formatos possíveis de segredo.

Registro compartilhado, imutabilidade do serviço, tarballs canônicos, reconciliação das integridades e CI remoto continuam pendentes. A aprovação por leitura não encerra esses requisitos nem aprova o gate inteiro pelos demais papéis.

## Encerramento

Nenhum serviço, porta, contêiner, teste ou mutação iniciado. Nenhum processo recebeu sinal e nenhum processo alheio foi administrado. PIDs 21265 e 21272 ignorados. Nenhuma leitura ou escrita no projeto proibido. Nenhuma alteração de produto, configuração global, git, .git ou .agents; nenhuma publicação ou push. Escrita somente neste diretório autorizado do revisor. git status final igual ao inicial: alterações preexistentes em moldura e domínio-stub.
