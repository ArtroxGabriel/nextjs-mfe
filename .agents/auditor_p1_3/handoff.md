# auditor_p1_3 (final)

**Veredito: VETO. Veto somente por cobertura de testes.**

Amostra M3, M6, M11, M12 e M13 reproduzida: todas capturadas e restauradas para verde. Das doze mutações novas, nove foram capturadas e três sobreviveram. A02 e A10 rompem garantias explícitas do ADR-0016; A09 remove a reconsulta local documentada imediatamente antes da publicação. As três tiveram contraprova comportamental que passa no original, falha no mutante e passa na restauração. Nenhum defeito de produto confirmado no código original. Não há correção de produto proposta ou aplicada nesta auditoria.

## Escopo e método

Principal `958c4a8..01691c0`, incluindo a correção `dde6957` e os handoffs da iteração 3. Shell `bd513635d09202548cc3bd3b5793c68ac246a135`; núcleo `df5b0f453f6e212242e7d92648d2a52281c54c17`, que muda somente teste. Revisor e challenger aprovados, lidos como evidência independente, sem substituir a execução forense.

Lidos AGENTS.md, LEIA-PRIMEIRO, CODEX, AMBIENTE, RETOMADA, plano P1 com M1 a M14, ADR-0016, D34 e os seis handoffs `.agents/*_p1_*/handoff.md`. Diff completo preservado em diff-principal.patch, diff-shell.patch e diff-nucleo.patch. Lidos também manual completo, código do publicador, testes, guarda do shell, teste controlado e algoritmo comum do núcleo.

Evidência anterior do worker consultada em mutacoes, mutacoes-finais e mutacoes-executor.log. As nove mutações M não amostradas mantêm a classificação do worker; não foram repetidas nem reclassificadas. As cinco amostras têm aplicação própria, logs de baseline, falha e restauração. Cada mutação nova tem patch e três execuções. Mutações sequenciais, sem alteração de arquivo sob execução de testes.

Cópia integral independente em `copia/`, dentro deste diretório autorizado, com fontes, dependências e builds copiados. Zero links de dependência para fora da cópia, conforme symlinks-fora.json. Os lockfiles da cópia foram obtidos dos commits dos respectivos submódulos. Lockfiles soltos de moldura e stub não foram alterados nem usados como fonte canônica.

## Achados que sustentam o veto

### A02: token de escrita no ambiente dos filhos não é detectado

- Aplicação: `copia/base/scripts/pacotes.mjs:32`, função ambienteSemTokens. Removida somente `ERP_NPM_TOKEN_PUBLICACAO` da lista de exclusão. Patch A02.patch.
- Promessa: ADR-0016, decisões 5 e 6; docs/REGISTRO-E-CI.md, publicação sem token no ambiente do build.
- Suíte existente com mutante: scripts 60/0/0, estática 52/0/0 e lockstep saída 0. Nenhum teste reprovou.
- Contraprova: quatro variáveis de token receberam sentinelas fictícias, sem imprimir valores. Filhos Node reais receberam exatamente opts.env dos callbacks de install, Git status/rev-parse, build, pack e publish. Com o original, os quatro indicadores são false em todas as fases. Com o mutante, ERP_NPM_TOKEN_PUBLICACAO é true nas seis fases. A asserção reprova; restauração volta a false.
- Lacuna: testes atuais atribuem tokens ao objeto config e conferem que opts.env não contém a chave, mas não semeiam a chave correspondente no process.env do publicador. A asserção fica verdadeira mesmo com essa entrada retirada do filtro.
- Correção suficiente: teste permanente semeando as quatro chaves no ambiente do processo, observando argv/env de instalação e das fases de publicação, com restauração do ambiente no fim. A02 deve reprovar esse teste.
- Evidência: A02-mutante.log, A02-familia-scripts.log, A02-familia-estatica.log, A02-familia-lockstep.log e A02-contraprova-antes/mutante/revertida.log. Nenhum valor de token foi salvo nesses logs.

### A09: retirar a segunda consulta de ausência sobrevive

- Aplicação: `copia/base/scripts/pacotes.mjs:249`, retirada somente da consulta e recusa imediatamente anteriores ao publish. Patch A09.patch.
- Promessa: docs/REGISTRO-E-CI.md e comentário do publicador: reconferir imediatamente antes da escrita. A imutabilidade atômica continua sendo responsabilidade do serviço, como no ADR; este achado não afirma que o preflight resolve corrida entre publicadores.
- Suíte existente com mutante: scripts 60/0/0, estática 52/0/0 e lockstep saída 0.
- Contraprova: mock próprio dá 404 na primeira consulta e metadata existente após pack. Original faz duas consultas, um pack e zero chamadas publish, com erro publicado por outro processo. Mutante faz um pack e uma chamada publish; a segunda consulta acontece somente na confirmação posterior, quando já é tarde para a recusa local. Restauração volta a zero publish.
- Correção suficiente: teste permanente de mudança de 404 para 200 entre preflight e pack, exigindo zero chamadas publish. Status 401/500/3xx nessa segunda consulta também devem permanecer erros, sem escrita.
- Evidência: A09-mutante.log, A09-familia-*.log e A09-contraprova-antes/mutante/revertida.log. Publicação foi um callback de fixture, sem escrita em registro real.

### A10: loopback por prefixo aceita HTTP externo sem reprovação

- Aplicação: `copia/base/scripts/pacotes.mjs:17`, substituição de includes(url.hostname) por some(host => url.hostname.startsWith(host)). Patch A10.patch.
- Promessa: ADR-0016, decisão 2: HTTPS obrigatório fora de loopback.
- Suíte existente com mutante: pacotes 10/0/0; confirmação completa scripts 60/0/0, estática 52/0/0 e lockstep saída 0.
- Contraprova sem rede: `http://localhost.attacker.invalid/` e `http://127.0.0.1.attacker.invalid/` são recusados pelo original, aceitos pelo mutante e recusados na restauração. Nenhuma consulta DNS ou HTTP desses endereços foi feita.
- Correção suficiente: acrescentar esses hostnames semelhantes aos casos negativos do teste permanente de configuração, mantendo positivos para loopback exato.
- Evidência: A10-mutante.log, A10-familia-*.log e A10-contraprova-antes/mutante/revertida.log.

Os três achados são lacunas de cobertura sobre comportamentos que o código atual já implementa corretamente. Bastam novos testes permanentes que capturem os mutantes. Nenhum achado histórico do worker, revisor ou challenger foi reclassificado.

## Tabela de mutações

Códigos em ordem baseline / mutante / restauração. Falha de asserção esperada é captura. Os patches usam caminhos relativos à cópia, nunca à árvore original.

| ID | Aplicada onde ou fonte | Mutação | Teste que pegou ou resultado | Códigos |
|---|---|---|---|---|
| M1 | Evidência worker mutacoes-finais | Classificação histórica preservada; não reaplicada | Capturada pelo worker; versao existente, 401 e 500 nunca chegam ao build ou publish | Não executada nesta auditoria |
| M2 | Evidência worker mutacoes-finais | Classificação histórica preservada; não reaplicada | Capturada pelo worker; versao existente, 401 e 500 nunca chegam ao build ou publish | Não executada nesta auditoria |
| M3 | base/scripts/pacotes.mjs | Remove comparação de integrity no preflight | Capturada; hash diferente impede instalacao e preserva lockfile e node_modules | 0 / 1 / 0 |
| M4 | Evidência worker mutacoes-finais | Classificação histórica preservada; não reaplicada | Capturada pelo worker; redirect do registro nao recebe token nem e seguido | Não executada nesta auditoria |
| M5 | Evidência worker mutacoes-finais | Classificação histórica preservada; não reaplicada | Capturada pelo worker; registro externo exige HTTPS; CI nao cai silenciosamente no Verdaccio local | Não executada nesta auditoria |
| M6 | base/scripts/pacotes.mjs | Omite --frozen-lockfile | Capturada; instalacao usa lock congelado, registro por escopo e arquivo privado removido ao terminar; pnpm real instala fixture com Authorization e lock congelado via pacotes.instalar | 0 / 1 / 0 |
| M7 | Evidência worker mutacoes-finais | Classificação histórica preservada; não reaplicada | Capturada pelo worker; tarball de publicacao troca destino local, registra commit e publica os bytes preparados uma vez; dist orfao nao entra no tarball real da publicacao | Não executada nesta auditoria |
| M8 | Evidência worker mutacoes-finais | Classificação histórica preservada; não reaplicada | Capturada pelo worker; D18: scripts de producao nao autorizam identidade dev implicitamente | Não executada nesta auditoria |
| M9 | Evidência worker mutacoes-finais | Classificação histórica preservada; não reaplicada | Capturada pelo worker; D18: producao sem IdP recusa antes de servir; somente showcase autoriza identidade dev | Não executada nesta auditoria |
| M10 | Evidência worker mutacoes-finais | Classificação histórica preservada; não reaplicada | Capturada pelo worker; nucleo declarado sem resolucao no lockfile reprova | Não executada nesta auditoria |
| M11 | base/scripts/pacotes.mjs | Remove limpeza integral de dist | Capturada; dist orfao nao entra no tarball real da publicacao | 0 / 1 / 0 |
| M12 | base/scripts/pacotes.mjs | Remove handlers SIGINT e SIGTERM | Capturada; SIGINT durante instalar real remove auth e aguarda os filhos proprios; SIGINT durante publicar real remove auth e aguarda os filhos proprios; SIGTERM durante instalar real remove auth e aguarda os filhos proprios; SIGTERM durante publicar real remove auth e aguarda os filhos proprios; sinal apaga auth antes de esperar filho resistente e aplica teto de encerramento | 0 / 1 / 0 |
| M13 | base/scripts/pacotes.mjs | Remove cleanup em exit | Capturada; exit explicito durante autenticacao remove auth sincronamente | 0 / 1 / 0 |
| M14 | Evidência worker mutacoes-finais | Classificação histórica preservada; não reaplicada | Capturada pelo worker; sinal apaga auth antes de esperar filho resistente e aplica teto de encerramento | Não executada nesta auditoria |
| A01 | base/scripts/pacotes.mjs | Acrescenta token de leitura ao argv de install | instalacao usa lock congelado, registro por escopo e arquivo privado removido ao terminar | 0 / 1 / 0 |
| A02 | base/scripts/pacotes.mjs | Deixa credencial de escrita no ambiente dos filhos | sobreviveu; nenhuma reprovação | 0 / 0 / 0 |
| A03 | base/scripts/pacotes.mjs | Cria auth.ini com modo 0644 | instalacao usa lock congelado, registro por escopo e arquivo privado removido ao terminar; tarball de publicacao troca destino local, registra commit e publica os bytes preparados uma vez | 0 / 1 / 0 |
| A04 | base/scripts/pacotes.mjs | Remove cleanup comum em sucesso e falha | falha do instalador tambem remove autenticacao temporaria; instalacao usa lock congelado, registro por escopo e arquivo privado removido ao terminar; tarball de publicacao troca destino local, registra commit e publica os bytes preparados uma vez | 0 / 1 / 0 |
| A05 | base/scripts/pacotes.mjs | Trata qualquer 3xx de metadata como ausência | redirect do registro nao recebe token nem e seguido | 0 / 1 / 0 |
| A06 | base/scripts/pacotes.mjs | Trata 5xx como ausência de versão | versao existente, 401 e 500 nunca chegam ao build ou publish | 0 / 1 / 0 |
| A07 | base/scripts/pacotes.mjs | Instala antes do preflight dos hashes | hash diferente impede instalacao e preserva lockfile e node_modules | 0 / 1 / 0 |
| A08 | base/scripts/pacotes.mjs | Limpa .js órfão, preservando .d.ts órfão | dist orfao nao entra no tarball real da publicacao | 0 / 1 / 0 |
| A09 | base/scripts/pacotes.mjs | Remove consulta imediatamente anterior ao publish | sobreviveu; nenhuma reprovação | 0 / 0 / 0 |
| A10 | base/scripts/pacotes.mjs | Confunde prefixo de hostname com loopback e aceita HTTP externo | sobreviveu; nenhuma reprovação | 0 / 0 / 0 |
| A11 | repos/erp-shell/lib/configuracao.ts | Aceita emissor composto só de espaços em produção | D18: producao sem IdP recusa antes de servir; somente showcase autoriza identidade dev | 0 / 1 / 0 |
| A12 | repos/erp-nucleo/dist/fabricas/criarNucleo.js | Altera condição de parada do relógio controlado para <= limite | perdedor: relogio controlado prova teto de 300 ms, sem nova chamada ao IdP ou exclusao | 0 / 1 / 0 |

M1 a M14 permanecem cobertas na evidência do worker, com as cinco confirmações independentes acima. A tabela não transforma as outras nove em execuções desta auditoria. mutacoes.txt contém 26 linhas únicas: 17 executadas e 9 referências históricas explícitas.

## Regressão por família

| Família | Resultado definitivo | Saída integral |
|---|---|---|
| task test | 579 pass, 0 fail, 0 skip, 0 cancelled | regressao-test-final-3.log |
| task verificar:estatica | 52 pass, 0 fail, 0 skip, 0 cancelled | regressao-estatica.log |
| task scripts:test | 60 pass, 0 fail, 0 skip, 0 cancelled | regressao-scripts.log |
| task lockstep | Saída 0; núcleo 0.10.4 nas quatro apps | regressao-lockstep.log |
| task verificar:construir | Não iniciado: portas fixas ocupadas por listeners alheios | regressao-e2e.log; portas-antes-e2e.txt; portas-rechecagem-e2e.txt; portas-finais.txt |

A família de unidades exigiu preparação da cópia: o pnpm tentou reinstalar ao encontrar caminhos antigos nos metadados, e depois ao comparar o lock canônico da moldura com a dependência local instalada. O Verdaccio não estava no ar. Essas duas tentativas passaram 20 e 307 testes respectivamente, mas terminaram antes de completar a família. Ambas preservadas em regressao-test.log e regressao-test-2.log. Uma terceira tentativa recusou o valor never de verifyDepsBeforeRun, sem executar testes. A configuração aceita false foi confirmada por pnpm config get e usada somente nos pnpm-workspace.yaml da cópia. A quarta tentativa executou task test integralmente sobre dependências copiadas, sem reinstalação, com 579/0/0. Nenhum hash foi alinhado e nenhum serviço externo foi iniciado.

As famílias scripts, estática e lockstep também foram repetidas sob cada um dos três sobreviventes: todas verdes. As contraprovas temporárias são evidência do auditor e não contam como testes permanentes do produto. Todas voltaram a verde depois de restaurar o código.

D18: A11 reprova ao aceitar emissor composto só de espaços. As duas provas D18 do shell continuam verdes após restauração. M8/M9 permanecem como classificadas pelo worker e as subidas reais da iteração 3 permanecem evidência do challenger; não foram repetidas nesta auditoria.

Núcleo: A12 altera a parada do laço para <= limite na saída compilada isolada. O teste controlado de df5b0f4 falha por não resolver no teto de 300 ms, com 0 pass e 1 fail; original e restauração têm 1 pass. A falha foi a asserção do teto, não timeout ou cancelamento. Não foi enfraquecido o teste. A garantia continua algorítmica, com store imediato, não prazo de escalonamento de produção.

D34: nenhum novo veto pelo redirect de tarball. Metadata recusa 3xx, downloader pnpm 12.5.1 segue redirects conforme limite declarado. Os testes permanentes de bytes canônicos, bytes adulterados, Authorization ausente no destino e lock preservado passaram na família scripts. Não se amplia a conclusão para outros destinos ou cadeias. Registro oficial e CI remoto continuam pendentes; esta auditoria não conclui P1 operacional.

## Contagens brutas

- Mutações independentes: 17, sendo 5 amostras M e 12 novas A; 14 capturadas e 3 sobreviventes.
- Amostras M, mutantes: 45 testes, 35 pass, 10 falhas esperadas, 0 skip, 0 cancelled. Baselines e restaurações: 45/0/0 em cada conjunto.
- Mutações novas A: 209 testes, 197 pass, 12 falhas esperadas, 0 skip, 0 cancelled. Baselines e restaurações: 209/0/0 em cada conjunto.
- Total primário mutantes: 254 testes, 232 pass, 22 falhas esperadas. Baselines 254/0/0; restaurações 254/0/0.
- Confirmação dos sobreviventes por família: 336 testes, todos verdes, mais três execuções lockstep com saída 0.
- Contraprovas comportamentais: 9 execuções; 6 controles verdes e 3 falhas deliberadas sob os mutantes. Não são execuções node:test.
- Regressão definitiva do original: 691 testes, 691 pass, 0 fail, 0 skip, 0 cancelled; lockstep saída 0.
- Todas as saídas node:test desta auditoria, incluindo repetição e preparação incompleta: 2116 testes, 2094 pass, 22 falhas deliberadas, 0 skip, 0 cancelled. As tentativas incompletas acrescentam 327 pass e não certificam uma família inteira.
- Comandos medidos por rodar.py: 76; 56 códigos zero e 20 não zero. Não zero: 14 execuções de mutantes capturados, 3 contraprovas deliberadas e 3 tentativas de preparação das unidades.
- Ponta a ponta: 0 testes executados, nenhuma execução reivindicada. Porta ocupada não foi registrada como teste pulado.

Contagens mecanicamente consolidadas em contagens-brutas.json, resultados-mutacoes.json e contraprovas-resultados.json. Saídas completas em arquivos, sem canalização para head.

## Encerramento e limites

Handoff escrito desde o início com (parcial), atualizado por etapa e por mutação. Histórico dos rascunhos em historico-parcial.md.

Original intacto: git-status-final.txt é idêntico ao inicial, somente modificações preexistentes em moldura/stub. Hashes dos oito lockfiles originais idênticos ao início. Todos os arquivos mutados na cópia foram restaurados byte a byte, conforme integridade-final.json. Zero auth.ini remanescente em toda a árvore desta auditoria. Logs de tokens fictícios mascarados; contraprovas de ambiente gravam somente booleanos.

Nenhuma leitura ou escrita no diretório externo proibido. PIDs 21265 e 21272 ignorados. Nenhum sinal a processo alheio, push, publicação externa, alteração de configuração global ou Git do produto. Sinais das provas permanentes foram somente em controladores e filhos próprios de fixture. Mocks usam loopback próprio, com ss -ltnp antes de abrir portas; foram fechados pelas fixtures. Listeners alheios nas portas 3000, 3001, 3002, 4020 e 4030 não foram acessados nem administrados.

Próxima iteração pode corrigir somente os testes para A02, A09 e A10 e receber um auditor novo, conforme a regra de veto só por teste. Revisor e challenger não precisam ser reexecutados se a correção permanecer só em testes. A ponta a ponta ainda precisa ser executada quando suas portas estiverem livres, sem agir sobre os serviços alheios.
