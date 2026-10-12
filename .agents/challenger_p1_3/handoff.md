# challenger_p1_3 (final)

**Veredito: APROVA o escopo local atacado do gate P1, iteração 3.** Nenhum achado adversário bloqueante nas execuções descritas. Isso não fecha P1 operacional, CI remoto ou ativação do registro oficial.

Escopo: diff principal 958c4a8..dde6957, incluindo dc4922a, eab0e38 e correção dde6957; shell bd51363; núcleo df5b0f4, somente teste. Li AGENTS.md, simulador-condicoes.md, LEIA-PRIMEIRO.md, CODEX.md, RETOMADA.md, AMBIENTE.md, ADR-0016, plano P1, quatro handoffs anteriores, D34 e documentação do registro. Li também o checklist de segurança e as seções 6 e 9 da especificação indicadas pelo simulador.

Handoff criado com (parcial) antes da revisão e atualizado após preparação, ataques, shell e limpeza. Nenhum produto, configuração global, Git, .agents ou .git alterado. Nenhum push ou publicação em serviço real. Fixtures publicadas somente no mock próprio em loopback. Não acessei o projeto proibido nem enviei sinais a processos alheios. PIDs 21265 e 21272 ignorados. Status Git final igual ao inicial: modificações preexistentes somente em repos/erp-dominio-stub e repos/erp-moldura.

## 1. Achados adversários

Nenhum novo achado confirmado. A lista abaixo conserva a severidade original dos achados anteriores e registra o que foi executado para conferir a correção ou declaração.

| Achado anterior | Arquivo/linha atual ou referência anterior | Evidência desta rodada | Resultado |
|---|---|---|---|
| Challenger 2 A1, alta, SIGINT deixa token no disco | base/scripts/pacotes.mjs:120, limpeza em :124, auth em :158 | Duas repetições de cada combinação install/publish e SIGINT/SIGTERM, oito interrupções reais. Auth com token observada antes; zero auth/token depois; zero filhos vivos registrados | Corrigido no comportamento medido |
| Revisor 2 P2.1, dist antigo no tarball | base/scripts/pacotes.mjs:223 | Dois publishes concluídos no mock e quatro interrompidos após PUT, todos com npm pack real. Orfao.js e orfao.d.ts plantados antes do build não entraram em nenhum payload recebido | Corrigido no comportamento medido |
| Revisor 2 P2.2, scripts e resíduos particulares versionados | Referências antigas: docs/superpowers/reports/2026-10-12-p1-retomada/README.md:57 e Taskfile.yml:57 | escopo-residuos.json: relatório e sete scripts ausentes; zero entradas correspondentes no Taskfile | Correção de escopo observada no checkout |
| Challenger 2 A2, média, redirect de tarball seguido | base/scripts/pacotes.mjs:199; docs/REGISTRO-E-CI.md:15; .agents/orchestrator/DEFERRED.md:231, D34 | Quatro instalações por redirect aceitaram bytes canônicos; duas com adulteração recusaram SHA-512; zero Authorization nos seis pedidos ao destino | Comportamento permanece, agora declarado como D34, com evidência correspondente; não foi declarado corrigido |
| Challenger 1, view sem autenticação confirmada | base/scripts/pacotes.mjs:199, --userconfig | Quatro view/install reais imprimiram 1.0.0 e instalaram @erp/fixture; todos os pedidos ao registro tinham Bearer de fixture válido | Autenticação confirmada nesta condição |
| Revisor 1 | Handoff anterior aprovava por leitura, sem achado | Não havia achado individual a reparar | Nenhuma reclassificação |

Não reclassifiquei achado anterior sem fato novo. O redirect foi tratado como declaração explícita aprovada para o escopo de medição D34; não como recusa implementada.

Credencial: arquivo de auth observado 0600. Na segunda rodada houve 916 varreduras de /proc de processos próprios, a cada 10 ms, com 64 registros de processos; o detector acumula qualquer ocorrência do valor exato em cmdline. Zero detecções no argv, zero no stdout/stderr capturado e zero nos arquivos regulares próprios após cada operação. A primeira rodada também registrou zero, mas retinha só a última amostra de cada PID; foi repetida para fortalecer a evidência. Tokens foram gerados em memória e mascarados antes da gravação de logs/JSON. A procura em disco cobriu árvores próprias de fixture, TMPDIR, caches npm/pnpm e store, incluindo logs npm. Não cobriu o disco inteiro ou processos alheios.

Sinais: enviados ao controlador, sem handlers acrescentados pelo wrapper. A operação usou o executor assíncrono do módulo real. Para install resistente substituí somente o binário pnpm por fixture resistente; para publish resistente npm pack foi real e somente npm publish foi substituído pelo filho resistente. Aos 101 ms depois de SIGTERM, nas quatro observações de resistência, authRestante=0, paiVivo=true e filho ainda vivo. Um segundo sinal durante a espera não abortou a limpeza. Com teto configurado de 800 ms, as saídas ocorreram após 815/811 ms no install e 812/815 ms no publish, sempre código 143. Isso demonstra limpeza antes da espera e encerramento perto do teto nas quatro amostras; não é uma promessa de escalonamento em produção.

## 2. Divergências declarado × observado

Nenhuma divergência nova observada nas condições executadas.

D34 corresponde à medição: origens de loopback distintas por porta, destino sem Authorization, bytes canônicos aceitos e adulterados recusados com ERR_PNPM_TARBALL_INTEGRITY, lock preservado. A consulta de metadata recusou 302 em install e publish com zero chamadas ao destino. O downloader seguiu o redirect de tarball; integridade não impediu a chamada ao destino. O requisito de o registro oficial servir bytes diretamente segue pendente de teste nesse serviço. Não inferi segurança para outras cadeias ou esquemas.

Shell: Ready apareceu antes da recusa nas três subidas negadas. Duas sem autorização e uma com ERP_PERMITIR_IDENTIDADE_DEV=true saíram 1 com IDP_EMISSOR obrigatório e nenhuma resposta HTTP servida. Duas com o valor exato 1 serviram /login HTTP 200. O comportamento coincide com a observação registrada em docs/REGISTRO-E-CI.md:61.

## 3. Medições e evidência bruta

Comandos executados nesta pasta, com seus caminhos absolutos:

```bash
node ataques.mjs
node ataques.mjs
node shell.mjs
python3 verificar-evidencias.py
```

A segunda execução de ataques.mjs acrescentou detecção acumulada de argv, contagem de varreduras e preservação dos tarballs recebidos pelo mock. Primeira rodada preservada em evidencia-r1.json, logs *-r1.log e cleanup *-r1.json. Segunda em evidencia.json e logs sem sufixo. Versões efetivamente medidas: Node 24.21.0, pnpm 12.5.1 e npm 11.19.0. Cada rodada teve 21 cenários de pacotes; o shell teve cinco execuções, total de 47 execuções de cenário.

| Sonda | Repetições totais | Resultado observado | Evidência |
|---|---:|---|---|
| pnpm view e install com arquivo produzido por pacotes.mjs | 4 | view 1.0.0, código 0, pacote instalado, três pedidos autenticados em cada, lock igual | auth-view-install-1/2.log, JSON de ambas as rodadas |
| Falha comum por specifier divergente | 2 | ERR_PNPM_OUTDATED_LOCKFILE, código 1, auth removida, lock igual | falha-lock.log |
| Preflight SHA-512 divergente | 2 | código 1; sentinela intacta; sem auth, filho pnpm, pacote instalado ou alteração de lock | integridade-divergente.log e JSON |
| HTTP externo configurado | 2 | código 1, exige HTTPS; zero pedidos ao mock e zero filhos de pacote | http-externo.log e JSON |
| Redirect de metadata | 2 por operação | HTTP 302, código 1; zero pedidos ao alvo e zero build/pack/publish | metadata-redirect-install/publish.log |
| Versão existente e HTTP 401/500 na consulta de publicação | 2 por status | código 1; nenhum filho Git/build/pack/publish; auth não criada | publicacao-200/401/500.log e JSON |
| Tarball preparado, publicado e confirmado no mock | 2 concluídas | código 0; commit igual ao marcador de origem; registry substituído; scripts removidos; órfãos ausentes; SHA-512 confirmado | tarball-publicado.log, tarball-publicado.tgz, manifest e membros no JSON |
| SIGINT e SIGTERM com pnpm install e npm publish reais | 2 por combinação | códigos 130/143, auth removida, filhos registrados inexistentes, lock igual | install-SIGINT/SIGTERM.log, publish-SIGINT/SIGTERM.log |
| Filho resistente e segundo sinal | 2 por operação | auth ausente durante a espera, filho vivo aos 101 ms; saída 143 após teto | install-resistente.log, publish-resistente.log e JSON |
| Exit explícito durante autenticação | 2 | código 7 e nenhuma auth restante | exit-explicito.log e JSON |
| Redirect de tarball com bytes canônicos | 4 | código 0, pacote instalado; um pedido sem Authorization ao alvo por execução | redirect-tarball-1/2.log e JSON |
| Redirect de tarball adulterado | 2 | ERR_PNPM_TARBALL_INTEGRITY, código 1; pacote não instalado, lock igual, auth removida | redirect-tarball-adulterado.log e JSON |
| Shell produção sem IdP/autorização | 2 | saída 1, recusa na subida, nenhuma resposta HTTP | shell-sem-idp-1/2.log |
| Shell autorização true | 1 | saída 1, mesma recusa | shell-autorizacao-true.log |
| Shell autorização 1 | 2 | /login HTTP 200; vivo até encerramento próprio | shell-showcase-1/2.log e HTML |

Saídas brutas representativas:

```text
1.0.0
Done in 26ms using pnpm v12.5.1
BUILD_TOKEN_ENV=false
Error: ERR_PNPM_TARBALL_INTEGRITY
[shell] nao sobe: configuracao invalida: IDP_EMISSOR e obrigatorio em producao; identidade dev exige autorizacao explicita do showcase
```

O membro do tarball publicado foi conferido por tar -tzf:

```text
package/dist/index.js
package/package.json
package/dist/index.d.ts
```

Manifesto recebido na segunda rodada, sem scripts nem destino local 4873:

```json
{"name":"@erp/fixture","version":"1.0.0","files":["dist"],"publishConfig":{"registry":"http://127.0.0.1:33947/"},"erpOrigem":{"commit":"bd513635d09202548cc3bd3b5793c68ac246a135"}}
```

Verificador das evidências, saída 0:

```text
evidencia-r1.json: 21 cenarios conferidos
evidencia.json: 21 cenarios conferidos
shell-evidencia.json: 5 cenarios conferidos
Cleanup: mocks fechados, zero processos registrados restantes, zero auth.ini
```

As sondas importam o módulo real base/scripts/pacotes.mjs do checkout. View foi executado no callback de instalar com o mesmo auth.ini produzido pelo módulo, seguido de install real. As demais instalações e publicações usaram o executor padrão do módulo. Para publicação fictícia, um shim local substituiu apenas as duas leituras Git por árvore limpa e pelo commit real do shell obtido antes: bd513635d09202548cc3bd3b5793c68ac246a135. Não houve Git init/add/commit nem mesmo na fixture. Assim esta prova mede o campo de origem e preparo de bytes; não certifica a correspondência de uma fixture ao conteúdo desse commit. Build da fixture, npm pack e npm publish normais foram reais.

Shell: next start real em cópia isolada do build existente, BUILD_ID WZznZxxl8j9kmLJhfuXJt. .next, configuração e package.json copiados; node_modules somente referenciado para leitura. Sem rebuild do produto. ACESSO_URL e DOMINIO_PLATAFORMA_URL apontaram para mock próprio, com zero pedidos durante /login. Não houve chamada às portas alheias 4020/4030.

Não houve medição de capacidade, latência sob carga, percentis ou distribuição de desempenho. Os tempos de encerramento são amostras individuais, duas por condição: install SIGINT 11/13 ms, SIGTERM 10/13 ms; publish SIGINT 17/14 ms, SIGTERM 15/14 ms. Outros agentes compartilhavam a máquina; não atribuí seus listeners ou contenção a esta rodada.

## Recursos e encerramento

ss -ltnp foi executado antes de cada mock e cada porta candidata do shell; snapshots preservados. Todos os listeners próprios usaram 127.0.0.1 e portas efêmeras:

- Pacotes rodada 1: registro 36725, alvo do redirect 44415.
- Pacotes rodada 2: registro 33947, alvo do redirect 42889.
- Mock do shell: 34147. Shells: 33235, 34065, 38149, 46061 e 45629.

PIDs e grupos próprios estão nos JSON de evidência/cleanup e pertencem aos namespaces das chamadas de ferramenta. Não devem ser tratados como PIDs para administrar no host. cleanup-ataques-r1.json, cleanup-ataques.json e shell-cleanup.json registram todos os mocks fechados e zero processos próprios registrados restantes. As oito interrupções reais encerraram seus filhos pelo controlador; os quatro resistentes foram encerrados após o teto. Não foi necessário sinalizar processo alheio. Shells autorizados receberam SIGTERM somente depois da medição.

Todas as árvores próprias de fixture, caches, stores, TMPDIR, sessões e build copiado foram removidas. cleanup-disco-r1.json e cleanup-disco.json registram authRestante=[] e tokenRemanescente=[]. Logs, scripts, HTML de /login, JSON e tarballs fictícios sem credenciais foram preservados. cleanup-final.json registra a limpeza adicional e busca por formatos de JWT/GitHub/npm; não encontrou correspondência. portas-final.txt e git-status-final.txt registram o encerramento. Nenhum dos dois órfãos antigos foi inspecionado ou recebeu sinal.

## Não executado e limites

Regressão inteira, mutações forenses, teste temporal do núcleo, navegador/Docker, CI remoto, registro externo, provisionamento e política atômica do serviço não foram executados. O pedido dispensou regressão inteira; serviço oficial e credenciais não estão disponíveis nem existe autorização para alvo externo. Não concluo P1 operacional.

Shell medido com build existente e /login, sem rebuild, IdP ou login completo. Não testei SIGKILL no controlador nem queda da máquina, condições em que a documentação não promete cleanup. Não varri disco inteiro, arquivos ou cmdline de processos alheios. Amostragem de argv não cobre todos os instantes. Filhos resistentes foram fixtures, separados das oito interrupções com pnpm/npm reais. D34 foi medido exclusivamente entre duas origens loopback de portas distintas; outras cadeias, esquemas e destinos continuam fora desta prova.
