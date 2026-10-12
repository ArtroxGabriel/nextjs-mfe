# Challenger P1, iteração 2 (final)

**Veredito: REPROVA.** Três interrupções reais por SIGINT deixaram o token de fixture no disco. A consulta de metadata recusou redirect; o download real do tarball seguiu redirect e instalou o pacote, sem Authorization no destino.

Escopo executado: principal dc4922a e eab0e38 contra 958c4a8; shell bd51363. Núcleo df5b0f4 lido como mudança somente de teste, sem repetir regressão. AGENTS.md, simulador-condicoes.md, LEIA-PRIMEIRO, CODEX, RETOMADA, AMBIENTE, ADR-0016, plano P1, relatório da retomada e dois handoffs anteriores lidos. Referências do simulador: checklist de segurança e seções 6 e 9 da especificação lidas.

Nenhum produto, configuração global, Git ou documento em .agents foi alterado. Somente fixture fictícia foi publicada para mock próprio em loopback. Projeto vizinho não acessado; processos alheios e PIDs 21265/21272 ignorados. Status Git final igual ao inicial: modificações preexistentes nos submódulos moldura e stub.

## 1. Achados adversários

### A1. Alta: SIGINT deixa credencial temporária no disco

Arquivo: `base/scripts/pacotes.mjs:98`, cleanup em `:103`, subprocesso síncrono em `:106` e chamadas em `:113` e `:159`.

Sonda: instalação real do pnpm com tarball pendente, seguida de `process.kill(-pid, 'SIGINT')` no grupo próprio. Duas repetições. Publicação real npm com resposta do PUT pendente, seguida do mesmo sinal: uma repetição. Nenhum processo externo recebeu sinal. O wrapper usou as funções reais do módulo, sem adicionar handlers de sinal.

Saída observada nos JSON:

```json
{"nome":"sigint-1","code":null,"signal":"SIGINT","tokenNoDisco":1,"cmdlineLeaks":0,"lockIgual":true}
{"nome":"sigint-2","code":null,"signal":"SIGINT","tokenNoDisco":1,"cmdlineLeaks":0,"lockIgual":true}
{"nome":"publicacao-sigint","code":null,"signal":"SIGINT","tokenNoDisco":1,"cmdlineLeaks":0,"lockIgual":true}
```

Em cada rodada, `tmp/mira-npm-*/auth.ini` continuava existente e continha o valor exato do token gerado em memória; modo 0600. Caminhos, modo e booleanos estão em `evidencia-r1.json` e `evidencia.json`. Não salvei seu conteúdo. O executor removeu os três arquivos após a observação; as pastas de fixture também foram removidas no fim. `tokenDepoisDaLimpeza` foi 0 em todos os cenários.

Correção concreta: remover sincronamente os arquivos temporários também no encerramento por SIGINT/SIGTERM/exit e controlar a finalização dos filhos antes da saída. Provar com processos reais interrompidos em install e publish. `finally` isolado não satisfez a garantia medida de remoção ao fim, declarada no ADR-0016, decisão 5.

### A2. Média: redirect do tarball é seguido pelo instalador real

Arquivo: `base/scripts/pacotes.mjs:113`; a consulta protegida em `:58` não cobre o downloader do pnpm.

Sonda adicional: metadata e SHA-512 corretos; endpoint `.tgz` responde 302 para segundo mock de outra porta loopback, que devolve os bytes canônicos. Duas repetições, store isolado novo em cada uma.

Saída observada:

```json
{"nome":"redirect-tarball","code":0,"pedidos":5,"alvo":1,"nodeModules":true,"lockIgual":true}
{"nome":"redirect-tarball-repeticao","code":0,"pedidos":5,"alvo":1,"nodeModules":true,"lockIgual":true}
{"url":"/fixture.tgz","bearerFixture":false,"authPresente":false}
```

Log real: `Packages: +1`, `downloaded 1, added 1`, `@erp/fixture 1.0.0`, `Done ... using pnpm v12.5.1`. Destino recebeu uma chamada em cada rodada, sem token. Não observei vazamento de token ao destino. A recusa solicitada no ataque de redirect não aconteceu nesta etapa do download. M4 do plano e o teste existente exercitam a consulta de metadata, que recusou corretamente.

Correção concreta: aplicar a política de recusa de 3xx ao downloader efetivo de tarballs, antes de seguir a localização, e acrescentar prova com `instalar` e pnpm reais. Não considerar o teste da consulta de metadata evidência de recusa em todo o fluxo.

## 2. Divergências declarado × observado

ADR-0016, decisão 5: arquivo temporário removido no fim. Observado: remoção em sucesso e falha comum, resíduo nas três interrupções por SIGINT descritas em A1.

Ataque de redirect: consulta de metadata recusada com `HTTP 302` e zero chamadas ao destino; download do tarball seguido com código 0. A distinção está medida em A2. Nenhum token chegou ao destino em nenhum desses cenários.

Não observei divergência na guarda de produção do shell. O log do Next anunciou `Ready` antes da mensagem de recusa, mas nenhuma resposta HTTP foi servida nas sondas recusadas; os processos saíram 1. A autorização exata do showcase serviu `/login` com 200.

## 3. Medições e evidência das sondas

Comandos executados com o caminho absoluto dos scripts neste diretório:

```bash
node ataques.mjs  # duas execuções; primeira versão preservada como ataques-r1.mjs
node shell.mjs    # uma execução
```

Versões medidas: Node 24.21.0, pnpm 12.5.1, npm 11.19.0. Os wrappers importam `base/scripts/pacotes.mjs` do checkout real. `view` foi executado dentro do callback de `instalar`, usando exatamente o arquivo de auth que o módulo preparou, antes do install real. Para publicação, só as duas respostas de Git da fixture foram substituídas: árvore limpa e commit real do shell lido com `git rev-parse`. Build da fixture, npm pack e npm publish foram reais, dirigidos exclusivamente ao mock.

| Sonda | Repetições | Comportamento observado | Evidência bruta |
|---|---:|---|---|
| pnpm view e install autenticados | 2 | view imprime 1.0.0; install sai 0, pacote instalado, 6 pedidos autenticados em cada rodada, lock intacto | auth-view-install-1.log, auth-view-install-2.log, evidencia-r1.json |
| Falha real por specifier divergente | 1 | ERR_PNPM_OUTDATED_LOCKFILE, código 1, lock intacto, auth removida | falha-lock.log, evidencia-r1.json |
| SIGINT durante install | 2 | SIGINT, auth com token continua no disco | sigint-1.log, sigint-2.log, evidencia-r1.json |
| SIGINT durante publish | 1 | SIGINT, auth com token continua no disco | publicacao-sigint.log, evidencia.json |
| Redirect de metadata ao instalar/publicar | 1 por operação | HTTP 302, código 1, zero chamadas no alvo, nenhum comando de empacotamento/publicação | redirect-metadata-install.log, redirect-metadata-publish.log, evidencia-r1.json |
| HTTP externo | 1 | configuração exige HTTPS, código 1; zero pedidos e zero filhos pnpm/npm | http-externo.log, evidencia.json |
| Publicação com versão existente | 1 | código 1, ja publicado; nenhum Git/build/pack/publish executado | publicacao-200.log, evidencia-r1.json |
| Publicação com 401 e 500 | 1 por status | código 1 com HTTP correspondente; nenhum Git/build/pack/publish executado | publicacao-401.log, publicacao-500.log, evidencia-r1.json |
| Tarball preparado e publicado no mock | 1 concluída | código 0; erpOrigem.commit igual ao commit lido; publishConfig.registry do mock, sem registry 4873 e sem scripts; SHA-512 confirmado | tarball-publicado-corrigido.log, evidencia.json |
| Preflight de integridade divergente | 1 | código 1, integrity diverge; lock idêntico, node_modules sentinela intacto, pacote não instalado, auth não criada | integridade-divergente.log, evidencia-r1.json |
| Redirect de tarball | 2 | código 0 e pacote instalado; uma chamada sem Authorization ao alvo em cada rodada | redirect-tarball.log, redirect-tarball-repeticao.log, dois JSON |
| Shell produção sem IdP nem autorização | 2 | processo sai 1, mensagem IDP_EMISSOR e obrigatorio, nenhuma resposta HTTP servida | shell-sem-idp-1.log, shell-sem-idp-2.log, shell-evidencia.json |
| Shell produção com autorização true | 1 | processo sai 1, mesma recusa | shell-autorizacao-true.log, shell-evidencia.json |
| Shell produção com autorização 1 | 2 | /login responde HTTP 200; processo vivo até SIGTERM próprio | shell-showcase-1.log, shell-showcase-2.log, HTML e shell-evidencia.json |

Nas operações concluídas e na falha comum, observei arquivo de auth 0600 durante a execução e zero arquivos contendo o token depois do fim. Procurei o valor exato do token nos argv de grupos próprios via `/proc/<pid>/cmdline`, amostrados a cada 15 ms, nos stdout/stderr capturados e nos arquivos regulares das árvores próprias de fixture, TMPDIR, cache npm e store pnpm isolados. Zero ocorrências nos argv e logs capturados. A segunda rodada de view teve argv completo do pnpm view e do install registrados. Amostragem não prova ausência em instantes que não foram capturados, e esta busca não cobriu o disco inteiro da máquina.

A primeira tentativa de publicação foi interrompida pela própria preparação incorreta da fixture: lock de consumidor com dependência ausente no manifesto publicável fez `pnpm build` recusar. Preservei `tarball-publicado.log` e o resultado no JSON da primeira rodada. Corrigi somente a fixture descartável e a repetição completou a publicação no mock.

Shell: `next start` real em cópia isolada do build existente, BUILD_ID WZznZxxl8j9kmLJhfuXJt, que contém a guarda nova. `.next`, package.json e configuração copiados para scratch; node_modules referenciado somente para leitura. Nenhum build de produto refeito. ACESSO_URL e DOMINIO_PLATAFORMA_URL apontados para mock próprio; ele recebeu zero pedidos nessas sondas de /login. Nenhuma chamada aos serviços alheios em 4020/4030.

Não foram medidas latência sob carga, percentis ou capacidade. Outros agentes usavam a máquina; surgiram listeners adicionais entre snapshots. Isso não foi interpretado como recurso desta rodada.

## Não executado e limites

Regressão completa, CI remoto, autenticação de registro externo, provisionamento ou política atômica de imutabilidade do registro não executados. Endereço/credenciais oficiais ausentes; não houve alvo externo autorizado. Nenhuma conclusão de P1 operacional. Não reexecutei as mutações forenses nem o teste temporal do núcleo, fora do ataque solicitado. Shell foi medido em start com o build existente, sem rebuild nem login completo. Não procurei token em arquivos de outros processos/projetos ou no disco inteiro; não testei SIGKILL.

## Recursos e encerramento

`ss -ltnp` executado antes de cada mock e candidato de porta, além do snapshot final. Todos os alvos foram loopback em portas efêmeras. Recursos reais desta rodada:

- Ataques, rodada 1: http://127.0.0.1:35977/, http://127.0.0.1:38849/. Mocks no PID 2 do namespace da ferramenta.
- Ataques, rodada 2: http://127.0.0.1:33683/, http://127.0.0.1:36307/. Mocks no PID 2 do namespace da ferramenta.
- Shell: mock http://127.0.0.1:38725; portas 44623, 34481, 32831, 39993, 43399.

`cleanup-ataques-r1.json`, `cleanup-ataques.json` e `shell-cleanup.json` registram mocks encerrados e zero processos próprios restantes nos grupos iniciados. Os PIDs listados nesses arquivos pertencem aos namespaces das chamadas de ferramenta, não são PIDs para administrar no host. Grupos do shell encerrados por SIGTERM após observar /login; grupos das sondas de SIGINT receberam apenas o sinal do ataque. Nenhum listener alheio recebeu sinal.

Os três auth.ini remanescentes foram removidos pelo executor após registrar o achado sem o valor. Todas as cópias, caches, stores e diretórios de fixture próprios foram removidos ao fim; `cleanup-disco.json` registra os diretórios removidos e zero auth.ini restante. Logs, scripts, JSON e tarball fictício de origem preservados nesta pasta. `portas-final.txt` e `git-status-final.txt` preservam a verificação final. Não há JWT ou valor de token salvo no handoff ou nos logs de evidência.
