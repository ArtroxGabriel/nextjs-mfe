# auditor_p1_4 (final)

**Veredito: PASS no gate local P1, iteração 4. Veto anterior só por teste resolvido. Nenhum novo veto.**

A02, A09 e A10, que sobreviveram na iteração 3, agora reprovam os testes permanentes novos. As cinco amostras exigidas, M3, M6, M11, M12 e M13, também reprovam. Cada aplicação teve controle verde antes, falha de asserção com o mutante e controle verde após reversão, com restauração byte a byte. Nenhum defeito de produto confirmado. Registro oficial e CI remoto permanecem pendentes; este PASS não conclui P1 operacional.

## Escopo, leitura e isolamento

Principal 958c4a8..20e9d1335ba4a549e73ee955cc7965dae0c978d4. Shell bd513635d09202548cc3bd3b5793c68ac246a135. Núcleo df5b0f453f6e212242e7d92648d2a52281c54c17, somente teste. O último commit do principal acrescenta seis testes e documentos de gate, sem mudança de produto. Revisor_p1_3 e challenger_p1_3 aprovaram a implementação anterior; seus vereditos foram lidos, sem substituir a prova desta rodada.

Lidos AGENTS.md, LEIA-PRIMEIRO.md, CODEX.md, AMBIENTE.md, RETOMADA.md, plano P1 e M1 a M14, ADR-0016, D34, todos os handoffs .agents/*_p1_*, incluindo worker_p1_4 e o veto/mutacoes.txt do auditor_p1_3. Conferidos diff, publicador, testes, Taskfile, workflows, documentação, ligação da guarda D18 e algoritmo/teste controlado do núcleo. Diffs completos em diff-principal.patch, diff-shell.patch e diff-nucleo.patch.

Handoff criado com (parcial) antes da leitura do diff e atualizado em cada etapa e mutação. Rascunhos em historico-parcial.md. Escrita somente nesta pasta autorizada. Cópia independente em copia/, incluindo dependências, sem .git de produto e sem links para fora. Os oito lockfiles da cópia foram extraídos dos commits; os lockfiles soltos de moldura/stub não foram usados como fonte canônica nem alterados no original.

Na cópia, verifyDepsBeforeRun: false evita reinstalação por metadados antigos e divergência entre lock canônico e dependência local já instalada. Não alinha hashes nem certifica uma instalação canônica nova. As fixtures de autenticação declaram caches/stores próprios. Nenhuma configuração global alterada. A cópia inicial teve rsync 23 apenas por chgrp recusado no config.yaml do Verdaccio copiado desnecessariamente; esse diretório foi removido e os oito repositórios reconferidos com oito saídas zero, antes de executar testes. Logs de preparação preservados.

## Prova da correção do veto

Patches A02, A09 e A10 são cópias byte a byte dos patches da contraprova anterior, aplicados sem Git e sem fuzz na cópia. A própria suíte permanente foi executada, sem acrescentar contraprova descartável ou enfraquecer teste.

| Mutação do veto | Teste novo | Antes pass/fail | Mutante pass/fail | Restaurada pass/fail | Códigos |
|---|---|---|---|---|---|
| A02 | tokens semeados no ambiente nao chegam aos filhos de install, git, build, pack e publish | 1/0 | 0/1 | 1/0 | 0/1/0 |
| A09 | reconsulta apos pack recebe 200, 401, 500 e 302 e impede publish | 4/0 | 0/4 | 4/0 | 0/1/0 |
| A10 | HTTP aceita somente hostname de loopback exato, nunca prefixo de hostname externo | 1/0 | 0/1 | 1/0 | 0/1/0 |

A02: as quatro chaves são semeadas e restauradas no finally. Filhos Node reais recebem exatamente opts.env em seis fases. Sob o mutante, a presença da chave de escrita é true nas seis fases; o esperado é false. O teste acumula todas as observações antes da asserção e grava somente booleanos, sem valores de token. O argv também é conferido.

A09: primeiro 404, depois resposta 200/401/500/302 após um pack. Os quatro mutantes executam uma chamada publish, contra zero esperado. A falha é a asserção anterior à avaliação da mensagem de erro. O original exige duas consultas, um pack e a sequência de fases correta. Publish é callback fictício, sem publicação externa.

A10: o mutante aceita hostname por prefixo e provoca Missing expected exception. Original e restauração recusam localhost.evil e 127.0.0.1.exemplo.com, mantendo localhost, 127.0.0.1 e [::1] exatos. Validação sem DNS ou HTTP para host externo.

Todas as seis falhas do veto são ERR_ASSERTION/testCodeFailure. Nenhum timeout, cancelamento ou falha de importação foi usado como captura. Logs A02/A09/A10-antes/mutante/revertida.log e metadados JSON preservados.

## Amostragem e proporcionalidade

M3 removeu a comparação de integrity e foi capturada por Missing expected rejection no preflight. M6 omitiu --frozen-lockfile: o teste dos argumentos e o pnpm real reprovaram; o instalador real aceitou specifier divergente sob o mutante. M11 omitiu a limpeza de dist: npm pack real incluiu os órfãos e a asserção do conteúdo reprovou. M12 omitiu handlers de SIGINT/SIGTERM: as quatro interrupções reais detectaram credencial no disco e o caso resistente também reprovou. M13 omitiu exit: a saída explícita deixou auth.ini e foi capturada. Todas retornaram a verde após reversão.

Evidência do worker consultada em mutacoes/, mutacoes-finais/ e mutacoes-executor.log, com fonte e resultados em evidencia-worker.json. As outras nove mutações M mantêm a classificação anterior. As nove mutações A já capturadas pelo auditor_p1_3 também não foram repetidas nem reclassificadas.

Busca proporcional por brechas nos testes novos concluída, sem brecha óbvia que justifique mutação adicional. Zero mutações novas, conforme a regra de 2026-10-06 e o despacho. A cobertura anterior de token no argv, modo 0600, cleanup comum, recusa de 3xx/5xx, ordem do preflight, .d.ts órfão, D18 e relógio permanece registrada como histórica. A02/A09/A10 têm fato novo: os seis testes permanentes acrescentados nesta correção.

D18 do shell: os dois testes de guarda/scripts passaram em task test. A11 e M8/M9 continuam como classificadas anteriormente, sem nova mutação ou nova reivindicação de sonda next start sem IdP. A ponta a ponta também comprovou a guarda de subida geral do shell. Núcleo: o teste controlado de df5b0f4 passou após compilar a cópia; prova teto algorítmico de 300 ms com store imediato, IdP uma vez e sessão preservada. A12 mantém a classificação anterior, sem reaplicação. Não se converte essa prova em prazo de escalonamento de produção.

D34 preservado: os dois testes reais de tarball passaram, com bytes canônicos aceitos, adulterados recusados, nenhuma Authorization no destino e lock preservado. Metadata recusa 3xx. A recusa ampla de redirect no downloader não está prometida; não houve nova classificação desse limite.

## Tabela completa de mutações

Execuções desta rodada e referências históricas estão separadas explicitamente. Códigos na ordem antes/mutante/restauração. Pass/fail da última coluna refere-se somente à execução mutada. Local de aplicação sempre na cópia.

| ID | Aplicação ou fonte | Mutação | Teste que pegou ou resultado | Códigos e pass/fail |
|---|---|---|---|---|
| M1 | Referência histórica: worker_p1_3/mutacoes-finais | Aceitar versão já publicada | Capturada anteriormente: versao existente, 401 e 500 nunca chegam ao build ou publish. Classificação preservada | Não executada nesta rodada |
| M2 | Referência histórica: worker_p1_3/mutacoes-finais | Tratar 401/500 como ausência | Capturada anteriormente: versao existente, 401 e 500 nunca chegam ao build ou publish. Classificação preservada | Não executada nesta rodada |
| M3 | Reaplicada em copia/base/scripts/pacotes.mjs | Omitir comparação de integrity no preflight | Capturada: hash diferente impede instalacao e preserva lockfile e node_modules | 0/1/0; 0/1 |
| M4 | Referência histórica: worker_p1_3/mutacoes-finais | Seguir redirect de metadata | Capturada anteriormente: redirect do registro nao recebe token nem e seguido. Classificação preservada | Não executada nesta rodada |
| M5 | Referência histórica: worker_p1_3/mutacoes-finais | Aceitar HTTP fora de loopback | Capturada anteriormente: registro externo exige HTTPS; CI nao cai silenciosamente no Verdaccio local. Classificação preservada | Não executada nesta rodada |
| M6 | Reaplicada em copia/base/scripts/pacotes.mjs | Omitir --frozen-lockfile | Capturada: instalacao usa lock congelado, registro por escopo e arquivo privado removido ao terminar; pnpm real instala fixture com Authorization e lock congelado via pacotes.instalar | 0/1/0; 0/2 |
| M7 | Referência histórica: worker_p1_3/mutacoes-finais | Publicar com publishConfig local | Capturada anteriormente: tarball de publicacao troca destino local, registra commit e publica os bytes preparados uma vez; dist orfao nao entra no tarball real da publicacao. Classificação preservada | Não executada nesta rodada |
| M8 | Referência histórica: worker_p1_3/mutacoes-finais | Autorizar dev em build/start | Capturada anteriormente: D18: scripts de producao nao autorizam identidade dev implicitamente. Classificação preservada | Não executada nesta rodada |
| M9 | Referência histórica: worker_p1_3/mutacoes-finais | Autorizar identidade dev implícita em produção | Capturada anteriormente: D18: producao sem IdP recusa antes de servir; somente showcase autoriza identidade dev. Classificação preservada | Não executada nesta rodada |
| M10 | Referência histórica: worker_p1_3/mutacoes-finais | Aceitar núcleo ausente no lockfile | Capturada anteriormente: nucleo declarado sem resolucao no lockfile reprova. Classificação preservada | Não executada nesta rodada |
| M11 | Reaplicada em copia/base/scripts/pacotes.mjs | Omitir limpeza integral de dist | Capturada: dist orfao nao entra no tarball real da publicacao | 0/1/0; 0/1 |
| M12 | Reaplicada em copia/base/scripts/pacotes.mjs | Omitir handlers SIGINT/SIGTERM | Capturada: SIGINT durante instalar real remove auth e aguarda os filhos proprios; SIGTERM durante instalar real remove auth e aguarda os filhos proprios; SIGINT durante publicar real remove auth e aguarda os filhos proprios; SIGTERM durante publicar real remove auth e aguarda os filhos proprios; sinal apaga auth antes de esperar filho resistente e aplica teto de encerramento | 0/1/0; 1/5 |
| M13 | Reaplicada em copia/base/scripts/pacotes.mjs | Omitir cleanup em exit | Capturada: exit explicito durante autenticacao remove auth sincronamente | 0/1/0; 5/1 |
| M14 | Referência histórica: worker_p1_3/mutacoes-finais | Esperar filhos antes de apagar credencial | Capturada anteriormente: sinal apaga auth antes de esperar filho resistente e aplica teto de encerramento. Classificação preservada | Não executada nesta rodada |
| A01 | Referência histórica: .agents/auditor_p1_3/mutacoes.txt | Token de leitura no argv | Capturada anteriormente: instalacao usa lock congelado, registro por escopo e arquivo privado removido ao terminar. Classificação preservada | Não executada nesta rodada |
| A02 | Reaplicada em copia/base/scripts/pacotes.mjs | Token de escrita no ambiente dos filhos | Capturada: tokens semeados no ambiente nao chegam aos filhos de install, git, build, pack e publish | 0/1/0; 0/1 |
| A03 | Referência histórica: .agents/auditor_p1_3/mutacoes.txt | auth.ini modo 0644 | Capturada anteriormente: instalacao usa lock congelado, registro por escopo e arquivo privado removido ao terminar; tarball de publicacao troca destino local, registra commit e publica os bytes preparados uma vez. Classificação preservada | Não executada nesta rodada |
| A04 | Referência histórica: .agents/auditor_p1_3/mutacoes.txt | Omitir cleanup comum | Capturada anteriormente: falha do instalador tambem remove autenticacao temporaria; instalacao usa lock congelado, registro por escopo e arquivo privado removido ao terminar; tarball de publicacao troca destino local, registra commit e publica os bytes preparados uma vez. Classificação preservada | Não executada nesta rodada |
| A05 | Referência histórica: .agents/auditor_p1_3/mutacoes.txt | Tratar 3xx como ausência | Capturada anteriormente: redirect do registro nao recebe token nem e seguido. Classificação preservada | Não executada nesta rodada |
| A06 | Referência histórica: .agents/auditor_p1_3/mutacoes.txt | Tratar 5xx como ausência | Capturada anteriormente: versao existente, 401 e 500 nunca chegam ao build ou publish. Classificação preservada | Não executada nesta rodada |
| A07 | Referência histórica: .agents/auditor_p1_3/mutacoes.txt | Instalar antes do preflight | Capturada anteriormente: hash diferente impede instalacao e preserva lockfile e node_modules. Classificação preservada | Não executada nesta rodada |
| A08 | Referência histórica: .agents/auditor_p1_3/mutacoes.txt | Preservar .d.ts órfão | Capturada anteriormente: dist orfao nao entra no tarball real da publicacao. Classificação preservada | Não executada nesta rodada |
| A09 | Reaplicada em copia/base/scripts/pacotes.mjs | Omitir reconsulta anterior ao publish | Capturada: reconsulta apos pack recebe 200 e impede publish; reconsulta apos pack recebe 401 e impede publish; reconsulta apos pack recebe 500 e impede publish; reconsulta apos pack recebe 302 e impede publish | 0/1/0; 0/4 |
| A10 | Reaplicada em copia/base/scripts/pacotes.mjs | Loopback por prefixo de hostname | Capturada: HTTP aceita somente hostname de loopback exato, nunca prefixo de hostname externo | 0/1/0; 0/1 |
| A11 | Referência histórica: .agents/auditor_p1_3/mutacoes.txt | Aceitar IdP só com espaços em produção | Capturada anteriormente: D18: producao sem IdP recusa antes de servir; somente showcase autoriza identidade dev. Classificação preservada | Não executada nesta rodada |
| A12 | Referência histórica: .agents/auditor_p1_3/mutacoes.txt | Laço de espera com <= limite | Capturada anteriormente: perdedor: relogio controlado prova teto de 300 ms, sem nova chamada ao IdP ou exclusao. Classificação preservada | Não executada nesta rodada |

mutacoes.txt tem 26 linhas únicas: oito reaplicações e dezoito referências históricas. Não converte referências em execuções desta auditoria. Patches em patches/, com logs individuais de aplicação e reversão.

## Regressão por família

| Família | Tests | Pass | Fail | Skip | Cancelled | Saída | Log integral |
|---|---|---|---|---|---|---|---|
| task test | 579 | 579 | 0 | 0 | 0 | 0 | regressao-test.log |
| task verificar:estatica | 52 | 52 | 0 | 0 | 0 | 0 | regressao-estatica.log |
| task scripts:test | 66 | 66 | 0 | 0 | 0 | 0 | regressao-scripts.log |
| task lockstep | Não é node:test | | | | | 0 | regressao-lockstep.log |
| task verificar:construir, arquivo | 135 | 129 | 0 | 6 | 0 | 0 | regressao-e2e.log |

Lockstep confirma @erp/nucleo 0.10.4 nas quatro apps. Todos os comandos foram executados na cópia. Saídas completas em arquivo, sem canalização para head. Famílias sem serviços executadas em paralelo somente após todas as mutações terem sido restauradas; nenhum arquivo foi mutado com teste rodando.

As portas fixas estavam ocupadas na observação inicial, mas ficaram livres sem intervenção desta auditoria. ss -ltnp e filtros foram reconfirmados antes de iniciar ponta a ponta, inclusive 4020. Os quatro builds foram produzidos na cópia. Sessão em arquivo; navegador real por Docker com imagem já instalada, sem pull e sem remoção da imagem. Execução de ponta a ponta levou 133,919 s.

Os seis pulos têm motivos explícitos: cinco casos exclusivos de Redis e um caso de token do Keycloak, indisponível. O navegador foi executado e passou. Não se afirma regressão Redis/OIDC/showcase nesta rodada e não se iniciou infraestrutura alheia para eliminar pulos documentados.

## Contagens brutas

- Oito mutações reaplicadas: oito capturadas, zero sobreviventes. Zero novas. Dezoito referências históricas preservadas.
- Controles antes: 22 testes, 22 pass, zero fail/skip/cancelled/todo.
- Mutantes: 22 testes, 6 pass, 16 falhas deliberadas, zero skip/cancelled/todo. As três mutações do veto produzem seis falhas; as cinco amostras M produzem dez.
- Controles restaurados: 22 testes, 22 pass, zero fail/skip/cancelled/todo.
- Provas dirigidas: 24 execuções node:test, 66 testes, 50 pass e 16 falhas deliberadas.
- Regressão sem ponta a ponta: 697 testes, 697 pass, zero fail/skip/cancelled, mais lockstep saída zero.
- Regressão incluindo ponta a ponta: 832 testes, 826 pass, zero fail, 6 skip, zero cancelled/todo.
- Total de todas as execuções node:test: 898 testes, 876 pass, 16 falhas deliberadas, 6 skip, zero cancelled/todo. É contagem de execuções, inclusive sobreposição de estática com ponta a ponta.
- Comandos medidos: 54, sendo 45 códigos zero e 9 não zero. Oito não zero são os mutantes capturados; um é o aviso rsync 23 de preparação, corrigido antes de testes. Inclui 16 comandos patch, nove comandos de cópia e cinco famílias. Leituras e checagens auxiliares não entram nesse total.

Consolidação mecanizada em contagens-brutas.json, contagens-mutacoes.json, resultados-mutacoes.json e comandos-medidos.json, derivada das saídas preservadas.

## Integridade, recursos e limites finais

integridade-final.json confirma todas as fontes versionadas originais intactas, os oito lockfiles originais idênticos, git status original inalterado, pacotes.mjs restaurado byte a byte e testes da cópia iguais ao original. Zero auth.ini restante, zero links para fora, portas fixas livres após cleanup e nenhum contêiner da imagem do navegador restante. Os snapshots de portas registram mudanças de listeners alheios sem atribuí-las a esta auditoria.

Sem leitura ou escrita no diretório externo proibido. PIDs 21265 e 21272 ignorados. Nenhum sinal enviado a processo que esta rodada não iniciou. Os sinais das provas permanentes foram limitados a controladores/filhos próprios de fixture e a base iniciada pela própria suíte. Git init/add/commit ocorre somente em fixtures descartáveis já previstas pelos testes, dentro desta pasta; nenhum Git de produto foi mutado. Sem escrita em .agents/.git do principal, configuração global, push ou publicação externa. Tokens fictícios mascarados nos logs; observações de ambiente contêm somente booleanos. Temporários e caches próprios foram limpos: 110 arquivos de execução contendo credenciais fictícias foram removidos, sem registrar valores. Logs, fontes e provas preservados; três diretórios vazios foram recriados para reprodução. Evidência em cleanup-disco.json e mascaramento-final.json.

Próximo passo do orquestrador: registrar este PASS no estado do gate. Ativação do registro, imutabilidade do serviço, migração de tarballs canônicos, reconciliação das integridades e CI remoto continuam pendentes, assim como a condição de fechamento de D34 no serviço oficial.
