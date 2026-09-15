# Manutenção — atividades no GitLab

O GitLab é atualizado **pelo humano**. O agente não tem acesso a ele; o papel do agente é
**avisar** quando uma atividade precisa ser atualizada, fechada ou criada, e entregar o
texto pronto para colar.

Leia este arquivo em toda retomada, junto com `RETOMADA.md`, e cheque os gatilhos ao fim de
cada unidade de trabalho (gate, task, decisão do humano).

## 1. Quando avisar

| Gatilho | Ação no GitLab |
|---|---|
| Começou trabalho numa atividade que estava parada | **Atualizar**: mover para "em andamento" |
| Gate de uma atividade passou, com evidência independente (handoffs dos três verificadores) | **Atualizar**: marcar critérios atendidos e citar a evidência; sugerir **fechar** se todos os critérios foram cumpridos |
| Gate reprovou ou o auditor vetou | **Atualizar**: comentar o bloqueio (V/R/B/F) e o que será corrigido |
| Uma task do plano da fatia 1 (`docs/superpowers/ESTADO.md`) concluiu | **Atualizar** a atividade que a contém (ver §3) |
| Defeito novo adiado (`DEFERRED.md` ganhou um `Dn`) que não cabe em nenhuma atividade existente | **Criar** atividade nova (modelo em §2) |
| Defeito adiado cabe numa atividade existente | **Atualizar**: acrescentar o `Dn` e a evidência |
| Humano mudou escopo, critério ou prioridade | **Atualizar** a descrição (critérios de aceitação) |
| Pedido aberto em `pedidos/` bloqueia uma atividade | **Atualizar**: marcar bloqueio e o arquivo do pedido |
| Trabalho feito que não corresponde a nenhuma atividade | **Criar** atividade, para o registro não ficar só no repositório |

Não avisar para: commits intermediários, rodadas de correção ainda dentro do mesmo gate,
mudanças só em arquivos de estado do `.agents/`.

**Regra de evidência:** só sugerir fechar uma atividade quando o resultado estiver registrado
em `GATE_STATUS.md` com handoff de cada verificador. Um registro de gate que cita apenas
arquivos do próprio worker não conta como revisão independente.

## 2. Como avisar

No fim da resposta ao humano, um bloco assim:

```
📌 GitLab
- Atualizar: "[Dev/Front] <título>" — <o que mudou>; evidência: <arquivo/commit>
- Criar: "[Dev/Front] <título>" — texto abaixo
```

Modelo para atividade nova (mesmo formato das existentes):

```
Título:

[Dev/Front] <Verbo + objeto> — <Subtítulo descritivo>

🎯 Objetivo*

<uma ou duas frases>

✅ Critérios de Aceitação

<critério verificável>

<critério verificável>

🧪 Casos de Teste

Cenário 1: <ação e resultado esperado>

🎨 Referência de Design

Link: N/A

📋 Caso de Uso

Link: N/A
```

## 3. Catálogo das atividades existentes (cadastrado em 2026-09-15)

Estado no GitLab desconhecido para o agente; a coluna "estado no repositório" é o que o
repositório prova.

| # | Título no GitLab | Itens internos | Estado no repositório (2026-09-15) |
|---|---|---|---|
| 1 | Finalizar a validação da prova de conceito — Validação e correção das revisões da PoC | Gate final combinado, V1, V2 | Gate 4 registrado como PASS em `9dc5d91`, mas as linhas citam "live run" e arquivos do `worker_base_features`; não há `reviewer_final_4`, `challenger_final_4` nem `auditor_final_4` em `.agents/`. **Não fechar** até haver handoffs independentes |
| 2 | Corrigir o encerramento do SSE — Gerenciamento de conexões e liberação de recursos | D1 | Aberto, sem trabalho |
| 3 | Tratar zonas travadas — Gestão de timeouts e isolamento de falhas no shell | D7 (e D6 como contexto) | Aberto; exceção documentada em `01-operacao.md` §5.1 |
| 4 | Padronizar a moldura compartilhada — Unificação de estrutura visual e estilos base | D11 (D2 fechado no gate 4) | Aberto |
| 5 | Adicionar testes no navegador — Cobertura de APIs do cliente e DOM | D9, D10 | Aberto; depende de aprovar dependência de DOM |
| 6 | Retomar a implementação do @erp/nucleo — Definição de portas, adaptadores e proteção | Fatia 1, tasks 3 a 6 | Tasks 3–6 concluídas e publicadas (`erp-nucleo` `b9bbbed`); minors em `ESTADO.md` §5 |
| 7 | Construir o shell real — Ponto de entrada e gateway das zonas da aplicação | Fatia 1, task 8 (`erp-shell`) | Não iniciado |
| 8 | Construir a zona inicial e stub de domínio — Prova de integração completa | Fatia 1, tasks 7 e 9 (`erp-dominio-stub`, `erp-mfe-pedidos`) | Task 7 concluída e revisada (stub `erp-dominio-stub`, APPROVE); task 9 não iniciada |
| 9 | Implementar sessão e autorização no servidor — Integração OIDC e cookie opaco | D3, Rodada 2 | Não iniciado |
| 10 | Implementar composição por fragmentos — Comunicação resiliente entre zonas | FragmentoRemoto, Rodadas 1–3 | Não iniciado |
| 11 | Centralizar o tempo real no shell — Gerenciamento único de conexões SSE via SharedWorker | Rodada 3 | Não iniciado; depende de #2 |
| 12 | Publicar o pacote visual @erp/ui — Centralização e versionamento de UI Kit | Rodada 4 | Não iniciado |
| 13 | Criar o mapa central de zonas — Fonte única da verdade para rotas e gateways | nome da zona em seis lugares | Não iniciado |
| 14 | Definir estratégia de publicação e compatibilidade — CI/CD e deploys independentes | lockstep do núcleo | Não iniciado |
| 15 | Migrar a arquitetura para Next.js 16 e App Router — Validação piloto e preservação de contratos | — | Não iniciado |
| 16 | Documentar riscos e decisões em aberto — Matriz de riscos e trade-offs arquiteturais | `O que falta…` §D, `ESTADO.md` §4 e §5.1 | Não iniciado; ganhou a divergência da invariante 3 e o `/_dev/revogar` sem credencial |

Ao criar uma atividade nova ou mudar o estado de uma existente, atualize esta tabela.

## 4. Pendências de aviso

Avisos já dados ao humano e ainda não confirmados. Remova a linha quando o humano confirmar.

| Data | Aviso |
|---|---|
| 2026-09-15 | #1: atualizar com o resultado do gate 4 e a lacuna de evidência independente; não fechar |
| 2026-09-15 | #6: atualizar — tasks 3 a 6 concluídas; mover para "em andamento" ou fechar conforme o critério de cobertura |
| 2026-09-15 | #8: mover para "em andamento" — stub de domínio concluído e revisado; zona Pedidos pendente |
| 2026-09-15 | #16: atualizar — acrescentar a divergência da invariante 3 (denylist × cabeçalho de dev) e o `/_dev/revogar` sem credencial |
| 2026-09-15 | Criar 4 atividades do anexo de `docs/revisao/2026-09-15-revisao-base-generica.md` (núcleo genérico, gestão de acesso, contrato shell↔zonas, revisão do harness) |
| 2026-09-15 | Atualizar #6 (núcleo: escopo muda para transporte por destino), #7 (shell: escritor único de sessão, domínios próprios, menu por módulos), #8 (zona 1/zona 2 de exemplo), #13 (mapa gerado dos manifestos), #4 (moldura ganha host de toast) |
