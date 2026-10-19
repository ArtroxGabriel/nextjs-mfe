# G4: Showcase com os atores da Gestão de Acesso v2

> **Para agentes:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Passos com `- [ ]`. Cada task traz a tabela de **mutações declaradas**, incluindo mutações de fronteira: o executor roda todas antes de pedir revisão e registra qual teste pegou cada uma.

**Objetivo:** Integrar os cinco atores do modelo de referência da gestão de acesso v2 (`docs/gestao-acesso/MODELO.md` e ADR-0014) no showcase da base (`task showcase` e `task showcase:oidc`), consolidar o roteiro manual (`docs/ROTEIRO-DE-VERIFICACAO.md`), expandir a verificação automatizada (`task showcase:verificar` e `task showcase:conferir`) cobrindo segregação estrita, permissões finas e revogação ativa (G5), e remover os resíduos do mock legado da v1 (porta 4010).

**Arquitetura:**
- Os 5 atores canônicos da unidade `central` da semente v2:
  - **Ana** (`ana`): Operadora (`zona1.padrao` e `zona2.operador`). Acessa `/` e o painel `/zona1` com o fragmento da `/zona2`; acessa `/zona2` e conclui tarefas (`tarefas.concluir`). Não vê relatórios nem `/acesso`.
  - **Bruno** (`bruno`): Analista (`zona1.analista`). Acessa `/` e `/zona1` com relatórios (`relatorios.ver`) e custos (centro de custo CC-10 do financeiro em `/zona1/recursos/r-1`). Não vê tarefas (`/zona2`) nem `/acesso`.
  - **Carla** (`carla`): Administradora de acesso (papel `admin-geral`, módulo `zona1.padrao`). Acessa `/acesso` para gerir acessos da unidade. Prova a **segregação estrita**: papel administrativo **não** concede módulo funcional — recebe 404 em `/zona2` e não vê custos CC-10 em `/zona1/recursos/r-1`.
  - **Davi** (`davi`): Usuário sem perfil especial (`zona1.padrao`). Não vê relatórios, tarefas nem `/acesso`. Usado para demonstrar revogação de acesso (perde `/zona1` sem perder a sessão na plataforma) e desligamento ativo (G5: encerra todas as sessões ativas imediatamente via `/v2/eventos`).
  - **Eva** (`eva`): Leitora (`zona2.leitor`). Acessa `/` e `/zona2` para visualizar tarefas, mas **não** possui a funcionalidade `tarefas.concluir` (ação protegida responde 404 se solicitada). Não vê `/zona1` nem `/acesso`.
- O roteiro manual (`docs/ROTEIRO-DE-VERIFICACAO.md`) ganha passos explícitos para Eva e para a revogação ativa por desligamento (G5).
- A verificação automática (`base/verificacao/showcase/showcase.test.mjs`) passa a validar os cinco atores, a recusa da ação de concluir para a leitora Eva e a revogação ativa no showcase.
- O mock legado da gestão de acesso v1 (`repos/erp-dominio-stub/src/gestao-acesso.mjs`, porta 4010) e suas referências transitórias são removidos, concluindo a transição definitiva para a v2 prevista no ADR-0014.

**Tech Stack:** Next.js 16 (App Router), `@erp/nucleo` 0.10.5, Node.js test runner, Redis, Keycloak (OIDC + PKCE).

**Spec:** `docs/gestao-acesso/MODELO.md`, `docs/adr/0014-gestao-de-acesso-v2.md` (Adendos 1, 2 e 3).

## Restrições Globais

- Preservar todos os 17 invariantes do `AGENTS.md`.
- Invariante 7: ausência de acesso é estritamente 404 (`NaoEncontrado`), sem placeholder de "sem acesso" (Invariante 8).
- Invariante 9: domínio decide autorização; o BFF esconde na UI e responde 404 em rota fora de escopo.
- Invariante 16: `exigirModulo(modulo, funcionalidade)` em camada 2 em toda página e `acaoProtegida` em toda Server Action.
- Proibir coautoria de IA nos commits (hook `no-ai-authorship`).
- Texto em documentação: sem travessão (`—` substituído por `-` ou reformulado onde exigido pelo estilo da base), sem emojis, sem `·` ou `→` concatenando itens, parágrafos objetivos.
- Não tocar no diretório vizinho `~/Documents/sisbin-planejamento-local` nem em suas portas.

## Foco de Revisão

1. Eva (`eva`) tentando disparar a action `concluirTarefa` da `/zona2`: deve receber 404 via `aoNegar` da `acaoProtegida` porque seu perfil `zona2.leitor` só concede `tarefas.ver`, nunca `tarefas.concluir`.
2. Carla (`carla`) acessando `/zona2`: deve receber estritamente 404, provando que `admin-geral` não contorna a regra de acesso efetivo.
3. Desligamento de Davi em tempo de showcase: ao postar desligamento no mock v2, a requisição seguinte de Davi ao shell deve ser redirecionada imediatamente para `/login` (G5).
4. Remoção da v1 (porta 4010): nenhuma dependência residual nas 4 apps ou nas verificações da base deve falhar.
5. Idempotência do reset de dados (`task showcase:dados:resetar`): semente v2 íntegra restaura os 5 atores e seus acessos originais.

---

## Mapa das Tasks

| Task | Escopo | Entrega | Depende de |
|---|---|---|---|
| 1 | erp-zona-2 | Proteger `concluirTarefa` com `exigirModulo('zona2', 'tarefas.concluir')` e validar Eva leitora | nada |
| 2 | base/showcase | Atualizar `conferir.mjs` e `showcase.test.mjs` com os 5 atores e revogação ativa G5 | 1 |
| 3 | docs | Atualizar `docs/ROTEIRO-DE-VERIFICACAO.md` e `docs/README.md` | 2 |
| 4 | erp-dominio-stub e base | Remover mock legado v1 (`gestao-acesso.mjs`, porta 4010) e dependências | 2, 3 |
| 5 | orchestrator e git | Verificação completa da base, atualização do `ATIVIDADES.md` e commits | 1, 2, 3, 4 |

---

### Task 1: Proteção fina de ação na `erp-zona-2` para Eva (leitora)

**Arquivos:**
- Modificar: `repos/erp-zona-2/app/zona2/acoes.ts`
- Modificar: `repos/erp-zona-2/app/zona2/page.tsx` (esconder botão de concluir para quem não tem `tarefas.concluir`)
- Testes: `repos/erp-zona-2/test/acoes.test.mjs`

**Contexto:**
Hoje a Server Action `concluirTarefa` usa `acaoProtegida` com o requisito do módulo (`'zona2'`). Para suportar a segregação da Eva (`zona2.leitor`, que tem `tarefas.ver` mas não tem `tarefas.concluir`), a action deve exigir a funcionalidade específica `'tarefas.concluir'`:
`acaoProtegida({ modulo: 'zona2', funcionalidade: 'tarefas.concluir' }, ...)` conforme ADR-0014 (decisão 2 e adendo 1).
E no painel da `/zona2`, o botão de concluir deve ser renderizado apenas se a pessoa tiver a funcionalidade (Invariante 8: ausência de permissão é ausência de elemento).

- [ ] **Passo 1: Escrever teste que reprova**:
  - Testar execução de `concluirTarefa` com usuário sem a funcionalidade `'tarefas.concluir'` (retorna erro/404 via `aoNegar`).
  - Testar com usuário que possui `'tarefas.concluir'` (conclui normalmente).
- [ ] **Passo 2: Implementar** na action `concluirTarefa` e no componente da página.
- [ ] **Passo 3: Rodar testes** da `erp-zona-2` (`cd repos/erp-zona-2 && pnpm test`).
- [ ] **Passo 4: Mutações declaradas**:
  - M1: Manter apenas `{ modulo: 'zona2' }` sem a funcionalidade -> teste com Eva/leitora reprova.
  - M2: Exigir funcionalidade errada (ex.: `'tarefas.ver'`) -> mutação reprova porque leitor conseguiria concluir.
- [ ] **Passo 5: Commit no submódulo `erp-zona-2`**.

---

### Task 2: Atualização de `conferir.mjs` e expansão de `showcase.test.mjs`

**Arquivos:**
- Modificar: `base/showcase/conferir.mjs`
- Modificar: `base/verificacao/showcase/showcase.test.mjs`

**Contexto:**
- Em `conferir.mjs`:
  - Garantir que a tabela de status HTTP mostre explicitamente as 7 rotas para todos os 5 atores (`ana`, `bruno`, `carla`, `davi`, `eva`).
  - Verificar que Eva tem 200 em `/zona2` e 404 em `/zona1` e `/acesso`.
  - Provar que Eva não consegue concluir tarefa em `/zona2`.
  - Provar a segregação estrita de Carla (200 em `/acesso`, 404 em `/zona2`).
- Em `showcase.test.mjs`:
  - No teste `F3`: incluir asserção de que Eva vê o menu com `['/', '/zona2']`, e não vê o bloco de tarefas na `/zona1`.
  - No teste `F4`: incluir asserção de que Eva recebe 404 em `/zona1` e `/acesso`, e Carla recebe 404 em `/zona2`.
  - No teste `F7` (ou novo `F8` / subtópico): testar que a Server Action `concluirTarefa` executada como Eva é negada (`aoNegar` redireciona para 404 / não conclui), enquanto como Ana é aceita.
  - Testar desligamento de Davi em tempo de execução: `POST /v2/pessoas/p-20/desligamento`, seguido de requisição ao shell que é imediatamente redirecionada para `/login` (validando G5 no showcase).

- [ ] **Passo 1: Escrever testes automatizados** em `showcase.test.mjs`.
- [ ] **Passo 2: Atualizar `conferir.mjs`**.
- [ ] **Passo 3: Executar `task showcase:conferir` e `task showcase:verificar`**.
- [ ] **Passo 4: Mutações declaradas**:
  - M1: Permitir Eva concluir tarefa -> teste de ação negada reprova.
  - M2: Carla acessar `/zona2` com 200 -> teste de segregação reprova.
  - M3: Desligamento de Davi não deslogar imediatamente -> teste do G5 no showcase reprova.

---

### Task 3: Atualização do Roteiro de Verificação Manual

**Arquivos:**
- Modificar: `docs/ROTEIRO-DE-VERIFICACAO.md`

**Contexto:**
Alinhar o roteiro manual às 7 funcionalidades e aos 15 passos para documentar:
- A presença da Eva (leitora de tarefas, botão de concluir ausente).
- O desligamento de Davi com revogação ativa imediata (G5).
- A tabela resumo das 7 funcionalidades com a cobertura de todos os atores.

- [ ] **Passo 1: Atualizar o arquivo `docs/ROTEIRO-DE-VERIFICACAO.md`**.
- [ ] **Passo 2: Conferir clareza e ausência de caracteres proibidos pelo estilo da base**.

---

### Task 4: Remoção do Mock Legado da Gestão de Acesso v1 (porta 4010)

**Arquivos:**
- Remover: `repos/erp-dominio-stub/src/gestao-acesso.mjs`
- Remover: `repos/erp-dominio-stub/test/gestao-acesso.test.mjs`
- Modificar: `repos/erp-dominio-stub/src/servidor.mjs` (remover porta 4010)
- Modificar: `repos/erp-dominio-stub/test/armazem.test.mjs` e `test/jwt-verificacao.test.mjs` (remover referências à v1)
- Modificar: `base/scripts/ambiente.mjs` (remover `PORTAS_SOB_DEMANDA['gestao-acesso']`)
- Modificar: `base/verificacao/base.test.mjs` (remover o teste de transição de v2 para v1 que subia a porta 4010)
- Modificar: `repos/erp-dominio-stub/README.md`, `repos/README.md`, `repos/erp-{shell,zona-1,zona-2,zona-acesso}/README.md` (ajustar documentação de portas e destinos)

- [ ] **Passo 1: Remover arquivos da v1 e limpar registros no `servidor.mjs` do stub**.
- [ ] **Passo 2: Atualizar testes do `erp-dominio-stub`** e rodar `pnpm test`.
- [ ] **Passo 3: Atualizar `base/scripts/ambiente.mjs` e `base.test.mjs`**.
- [ ] **Passo 4: Atualizar os READMEs**.
- [ ] **Passo 5: Rodar `task scripts:test` e `task test`**.
- [ ] **Passo 6: Commit no submódulo `erp-dominio-stub`**.

---

### Task 5: Verificação Completa e Atualização do Orquestrador

**Arquivos:**
- Modificar: `.agents/orchestrator/ATIVIDADES.md`
- Modificar: `.agents/orchestrator/RETOMADA.md`
- Modificar: `docs/adr/0014-gestao-de-acesso-v2.md`

- [ ] **Passo 1: Rodar suíte completa**: `task scripts:test`, `task lockstep`, `task verificar:estatica`, `task test`, `task typecheck`.
- [ ] **Passo 2: Atualizar `ATIVIDADES.md`**: marcar G4 e atividade #21 como concluídos.
- [ ] **Passo 3: Atualizar `RETOMADA.md`**.
- [ ] **Passo 4: Commitar no repositório raiz e salvar estado no `ai-memory`**.
