# Manutenção — atividades no GitLab

O GitLab é atualizado **pelo humano**. O agente não tem acesso a ele; o papel do agente é
**avisar** quando uma atividade precisa ser atualizada, fechada ou criada, e entregar o
texto pronto para colar.

Este arquivo diz **quando** e **como** avisar. O estado de cada atividade e os textos prontos
ficam em **`ATIVIDADES.md`**, que deve ser atualizado a cada aviso.

## 1. Quando avisar

| Gatilho | Ação no GitLab |
|---|---|
| Começou trabalho numa atividade que estava parada | **Atualizar**: mover para "em andamento" |
| Gate de uma atividade passou, com evidência independente (handoffs dos três verificadores) | **Atualizar**: marcar critérios atendidos e citar a evidência; sugerir **fechar** se todos os critérios foram cumpridos |
| Gate reprovou ou o auditor vetou | **Atualizar**: comentar o bloqueio (V/R/B/F) e o que será corrigido |
| Uma task de um plano concluiu | **Atualizar** a atividade que a contém (`ATIVIDADES.md`) |
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

Depois de avisar: atualize a linha em `ATIVIDADES.md` §2, a data do topo e o histórico em §4.

## 3. Resultado da última sincronização — 2026-09-23

Itens do GitLab filhos do #72. Entre parênteses, a atividade correspondente em `ATIVIDADES.md`.

**Fechadas**

- #112 — [Dev/Front] Finalizar a validação da prova de conceito — Validação e correção das revisões da PoC *(atividade 1)*
- #113 — [Dev/Front] Corrigir o encerramento do SSE — Gerenciamento de conexões e liberação de recursos *(atividade 2)*
- #115 — [Dev/Front] Padronizar a moldura compartilhada — Unificação de estrutura visual e estilos base *(atividade 4)*
- #116 — [Dev/Front] Adicionar testes no navegador — Cobertura de APIs do cliente e DOM *(atividade 5)*
- #117 — [Dev/Front] Retomar a implementação do @erp/nucleo — Definição de portas, adaptadores e proteção *(atividade 6)*
- #118 — [Dev/Front] Construir o shell real — Ponto de entrada e gateway das zonas da aplicação *(atividade 7)*
- #119 — [Dev/Front] Construir a zona inicial e stub de domínio — Prova de integração completa *(atividade 8)*
- #124 — [Dev/Front] Criar o mapa central de zonas — Fonte única da verdade para rotas e gateways *(atividade 13)*
- #126 — [Dev/Front] Migrar a arquitetura para Next.js 16 e App Router — Validação piloto e preservação de contratos *(atividade 15)*
- #127 — [Dev/Front] Documentar riscos e decisões em aberto — Matriz de riscos e trade-offs arquiteturais *(atividade 16)*
- #114 — [Dev/Front] Tratar zonas travadas — Gestão de timeouts e isolamento de falhas no shell — escopo original entregue; o que mudou de plano segue em #132 *(atividade 3)*
- #125 — [Dev/Front] Definir estratégia de publicação e compatibilidade — CI/CD e deploys independentes — escopo original entregue; o que mudou de plano segue em #133 *(atividade 14)*

**Criadas**

- #132 — [Dev/Front] Aprovar o health check das zonas em gate — /{zona}/api/health sem tocar domínio *(atividade 3b)*
- #133 — [Dev/Front] Publicar os pacotes por um registro único — lockstep no CI e versões imutáveis *(atividade 14b)*
- #134 — [Dev/Front] Centralizar a telemetria das zonas no shell — gateway OTLP com limites *(atividade 18)*
- #135 — [Dev/Front] Entregar o showcase da base — mocks em JSON, Keycloak e Redis *(atividade 19)*
- #136 — [Dev/Front] Migrar as apps para o kit de app — uma cópia só de sessão, módulo e actions *(atividade 20)*
- #137 — [Dev/Front] Evoluir a gestão de acesso — unidades, papéis com escopo e módulos com validação *(atividade 21)*
- #138 — [Dev/Front] Validar a base genérica BFF + Multi-Zones — shell, duas zonas e gestão de acesso — criada já fechada, para registro *(atividade 17)*
- #139 — [Dev/Front] Refinar a arquitetura com design patterns e padrões de arquitetura *(atividade F1)*
- #140 — [Dev/Front] Otimizar desenvolvimento e produção *(atividade F2)*
- #141 — [Dev/Front] Tornar o mapa de zonas robusto *(atividade F3)*
- #142 — [Dev/Front] Refinar a gestão de acesso *(atividade F4)*
- #143 — [Dev/Front] Padronizar os erros *(atividade F5)*
- #144 — [Dev/Front] Estruturar a camada de testes *(atividade F6)*
- #145 — [Dev/Front] Estruturar os testes de desempenho e segurança *(atividade F7)*

**Atualizadas**

- #121 — [Dev/Front] Implementar composição por fragmentos — Comunicação resiliente entre zonas — em andamento *(atividade 10)*
- #122 — [Dev/Front] Centralizar o tempo real no shell — Gerenciamento único de conexões SSE via SharedWorker — comentário de revisão *(atividade 11)*
