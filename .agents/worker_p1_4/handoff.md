# worker_p1_4 (final)

Correção concluída, limitada a testes. Nenhum defeito de produto observado. Próximo passo: auditor novo para a iteração 4; o worker não declara aprovação do gate.

## Alteração

Único arquivo editado no working tree: `base/scripts/pacotes.test.mjs`, 117 linhas adicionadas, seis testes novos. `base/scripts/pacotes.mjs` não foi editado no principal. Modificações preexistentes de moldura/stub preservadas.

- A02: semeia ERP_NPM_TOKEN, ERP_NPM_TOKEN_PUBLICACAO, NODE_AUTH_TOKEN e NPM_TOKEN no process.env do publicador. Restaura cada entrada no finally, inclusive a ausência original. Um filho Node real recebe exatamente opts.env em install, status, rev-parse, build, pack e publish. A observação contém apenas presença por chave e booleano de token no argv. Todas as seis fases são observadas antes da asserção final, inclusive sob mutação. Nenhum valor de token aparece nos logs.
- A09: quatro testes, um por status 200, 401, 500 e 302. A primeira consulta devolve 404; a segunda exige que pack já tenha terminado e devolve a versão existente ou o erro. Exige zero publish, erro adequado, um pack, duas consultas e a sequência consulta/status/rev-parse/build/pack/consulta. Publish é callback de fixture, sem publicação real.
- A10: loopback exato localhost, 127.0.0.1 e [::1] continua aceito. localhost.evil e 127.0.0.1.exemplo.com precisam ser recusados. Validação de configuração somente, sem DNS nem HTTP para estes hosts.

## Mutações

Cópia independente de base/scripts em copia/, suficiente para os testes selecionados e seus imports. Sem dependências externas ou symlinks. Patches são cópias byte a byte dos arquivos A02.patch, A09.patch e A10.patch do auditor_p1_3. Aplicação e reversão por patch, sem Git; operações sequenciais, nenhuma mutação durante execução de teste. Cada reversão compara pacotes.mjs byte a byte antes de rodar o controle restaurado. Logs completos e metadados JSON por comando.

| Mutação | Teste que capturou | Antes pass/fail | Mutante pass/fail | Revertida pass/fail | Códigos |
|---|---|---|---|---|---|
| A02 | tokens semeados no ambiente nao chegam aos filhos de install, git, build, pack e publish | 1/0 | 0/1 | 1/0 | 0/1/0 |
| A09 | reconsulta apos pack recebe 200, 401, 500 e 302 e impede publish | 4/0 | 0/4 | 4/0 | 0/1/0 |
| A10 | HTTP aceita somente hostname de loopback exato, nunca prefixo de hostname externo | 1/0 | 0/1 | 1/0 | 0/1/0 |

Falhas verificadas como ERR_ASSERTION/testCodeFailure, sem timeout, cancelamento ou falha de importação. A02 mostra presença da segunda chave nas seis fases. A09 mostra uma chamada publish, quando o esperado era zero, nos quatro casos. A10 mostra ausência da exceção esperada.

## Regressão e contagens brutas

| Família | Pass | Fail | Skip | Cancelled | Saída |
|---|---|---|---|---|---|
| task scripts:test | 66 | 0 | 0 | 0 | 0 |
| task verificar:estatica | 52 | 0 | 0 | 0 | 0 |
| task lockstep | não é node:test | | | | 0 |

Lockstep: @erp/nucleo 0.10.4 nas quatro apps. Regressões executadas no principal, com TMPDIR/P1_SCRATCH no diretório deste worker. Não houve execução de task test nem ponta a ponta nesta correção, que pediu somente estas três famílias.

- Nove execuções node:test de mutação: 18 testes, 12 pass, 6 falhas deliberadas, zero skip/cancelled/todo.
- Controles antes: 6 pass/0 fail. Mutantes: 0 pass/6 fail. Controles revertidos: 6 pass/0 fail.
- Regressão: 118 testes, 118 pass, zero fail/skip/cancelled/todo, mais lockstep saída 0.
- Total: 136 testes, 130 pass, 6 falhas deliberadas, zero skip/cancelled/todo.
- Executor validar.py: 18 comandos, sendo nove testes dirigidos, seis aplicações/reversões e três famílias; 15 códigos zero e três não zero esperados.

O Node produziu TAP nos testes dirigidos e spec nas tarefas. A consolidação aceita os dois formatos. Correção do parser aplicada e contagens recalculadas diretamente dos mesmos logs, sem repetir execuções ou acrescentar contagens.

## Integridade e limites

integridade-final.json confirma pacotes.mjs do principal intacto, oito lockfiles intactos, cópia restaurada e zero auth.ini remanescente. git-status-final.txt coincide com git-status-apos-testes.txt; os dois registram só o teste alterado e as modificações preexistentes dos submódulos. diff-final.patch contém somente a mudança de teste. git diff --check passou.

Sem acesso ao diretório externo proibido. PIDs 21265 e 21272 ignorados, sem sinais a processos alheios. Sem escrita em .git/ ou .agents/ do principal. Os testes existentes de processos usam Git e sinais apenas em fixtures próprias. Sem push, publicação real, serviços iniciados ou configuração global. Mocks locais encerrados pelas fixtures.

gate.md contém o parágrafo pronto para GATE_STATUS.md. O gate e P1 operacional continuam pendentes de suas verificações próprias.
