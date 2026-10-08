# O que vem depois do objetivo da base

**Estado:** aberto.
**Aberto em:** 2026-10-07.
**Para:** o humano responsável pela base.
**O que espera por isto:** todo trabalho novo. O objetivo da base está atingido (gate do E3, E4 e E5 aprovado em 2026-10-07, tag `gate-e3e5-aprovado`) e nada começa antes da resposta.

## Contexto

A base genérica BFF com Multi-Zones está de pé e tem um showcase usável. Um comando sobe Redis, Keycloak, domínios simulados com dados em JSON, o shell e três zonas. O roteiro tem uma linha por funcionalidade básica (F1 a F7), e uma suíte automática prova as sete linhas contra o showcase no ar, nos dois modos de login (desenvolvimento e Keycloak).

Ficaram três grupos de trabalho, todos combinados antes para "depois do objetivo", sem ordem decidida entre eles:

- **P1, registro de pacotes e CI** (combinado em 2026-09-23 para "o fim do plano"). Hoje os pacotes `@erp/*` só existem no Verdaccio de cada máquina; duas máquinas alternam commits de hash de lockfile e quebram a instalação uma da outra (paliativo: `task pacotes:alinhar-hashes`). Falta um registro único e a publicação e o lockstep checados no CI.
- **Itens adiados do objetivo** (decisão de 2026-10-06): C2, tempo real no shell (SSE e `SharedWorker`); B2, exportar os spans (SDK OpenTelemetry, instalação já aprovada); G4, gate e showcase com os atores da gestão de acesso v2; G5, revogação ativa por eventos (hoje uma lacuna de segurança declarada e aceita: uma concessão revogada só some na próxima leitura de acesso).
- **Lista 2, refinamento** (F1 a F7 do `RETOMADA.md`): padrões de arquitetura, otimização, mapa robusto, gestão de acesso, padronização de erro, camada de testes, testes de desempenho e segurança. Cada um começa por um pedido de detalhamento próprio.

## Pergunta

**Q1. Qual é a ordem?**
- (a) **P1 primeiro, depois G5, depois o resto pela ordem que você der. Recomendado.** O P1 é o único que atrapalha o trabalho a duas mãos hoje. O G5 é a única lacuna de segurança aberta.
- (b) Os itens adiados primeiro (C2, B2, G4, G5), depois P1, depois a Lista 2.
- (c) A Lista 2 primeiro, com os pedidos de detalhamento, e o resto depois.
- (d) Outra ordem.

**Q2. No P1, onde fica o registro e qual CI?** Só se a resposta da Q1 puser o P1 na frente. Exemplos: o registro de pacotes do próprio GitLab com GitLab CI; um Verdaccio compartilhado; outro. Se ainda não houver decisão, o agente escreve um pedido de detalhamento só do P1.

**Q3. Os menores adiados (`DEFERRED.md` D27 a D33)** entram como uma task de limpeza antes do próximo item, ficam para quando o código for tocado de novo, ou vão para a Lista 2 (F6 e F7)? Recomendado: ficam para quando o código for tocado de novo, como está escrito em cada um.

**Q4. Teto para veto só por teste em ferramenta do showcase?** O gate do E3, E4 e E5 levou 6 iterações: o challenger reprovou a primeira pelo texto do roteiro, e os auditores vetaram as quatro seguintes, todas só por teste e todas no comando da zona de demonstração (ferramenta do showcase, não código de produto). A regra atual (veto só por teste leva a um auditor novo) não tem teto.
- (a) **Sem teto, mas o auditor recebe as mutações já classificadas e julga com proporção. Recomendado.** Foi o que fechou este gate.
- (b) Teto de N iterações para ferramentas do showcase; depois disso, a mutação viva vira limite declarado no `DEFERRED.md`.
- (c) Ferramentas do showcase sem auditor; só revisor e challenger.

## Formato da resposta

Uma linha por pergunta: `Q1: (a)`, `Q2: ...`, `Q3: ...`, `Q4: ...`, com observação livre se quiser.

## Resposta

(vazia)
