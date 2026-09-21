# Atividades do GitLab — revisão viva

> **Este arquivo é a fonte da verdade sobre o estado de cada atividade do GitLab.** O agente o
> atualiza ao fim de todo gate, task ou decisão; o humano copia para o GitLab e marca a coluna
> "No GitLab?". Regras de quando avisar: `MANUTENCAO-GITLAB.md`.
>
> Última revisão: **2026-09-21, noite** (adaptador Redis e checagem de envio; gate do shell em andamento).

## 1. Como ler e manter

- **Estado real** é o que o repositório mostra hoje, com evidência. **Ação** é o que fazer no GitLab.
- **No GitLab?** — `pendente` até o humano confirmar que aplicou; então vira `feito (data)`.
- Só marque **Fechar** com gate registrado em `GATE_STATUS.md` (três handoffs) ou quando a atividade
  foi substituída. Implementado sem gate = **Em andamento**.
- Ao revisar: mude a linha, atualize a data do topo e acrescente uma linha em §4.

## 2. Atividades

### Abertas — trabalho que falta

| # | Título | Estado real | Ação | No GitLab? | Evidência |
|---|---|---|---|---|---|
| 3 | Isolar a falha de zona no shell da base *(era "Tratar zonas travadas")* | implementado, **gate em andamento** | reescrever título; mover para **em andamento** | pendente | `erp-shell` `6de4939`/`dab5ffd`/`a63b995`; `RETOMADA.md` |
| 9 | Trocar login e store de desenvolvimento por OIDC e Redis *(era "Implementar sessão e autorização no servidor")* | cookie opaco, escritor único e autorização por módulo entregues; **adaptador Redis pronto** (`@erp/nucleo` 0.4.0, 12 testes, 9 mutações pegas), falta ligar nas apps; faltam OIDC e renovação de token | reescrever título e critérios; mover para **em andamento** | pendente | ADR-0009 decisão 3; `erp-nucleo` `3a7b80c`; `alvo.md` §6 |
| 10 | Implementar composição por fragmentos | núcleo pronto (`@erp/nucleo` 0.5.0, 18 testes, 16 mutações); falta ligar zona 1 ← zona 2 e bloquear no shell | mover para **em andamento** | pendente | ADR-0011; `erp-nucleo` `1841771` |
| 11 | Centralizar o tempo real no shell | não iniciado | manter; tirar a dependência da #2 | pendente | `alvo.md` §6 (SSE) |
| 12 | Publicar o pacote visual @erp/ui | não iniciado; depende de medir duplicação de bundle | manter | — | `alvo.md` §6 |
| 14 | Definir estratégia de publicação e compatibilidade | submódulos **feitos**; hook `pre-push` que recusa submódulo não enviado **feito** (`repos/scripts/checar-envio.mjs`, provado com commit só local); falta registro único ou publicação pelo CI | acrescentar critérios: registro único, nunca republicar a mesma versão, checar submódulo não enviado antes do push, mapa de zonas vindo do domínio de acesso | pendente | ADR-0010; `AMBIENTE.md` §1–2; `4eb128b` |
| 18 | Centralizar a telemetria das zonas no shell *(nova)* | gateway implementado, **gate em andamento**; nenhuma zona envia traces | **criar** em andamento (texto em §3) | pendente | `erp-shell` `6de4939`; `alvo.md` §6 (Operação) |

### Fechar — entregues ou substituídas

| # | Título | Motivo | No GitLab? | Evidência |
|---|---|---|---|---|
| 1 | Finalizar a validação da prova de conceito | substituída pela base; PoC removida | pendente | tag `poc-final`; `73bdc8b` |
| 2 | Corrigir o encerramento do SSE | substituída (era da PoC); SSE da base é a #11 | pendente | `DEFERRED.md` D1 |
| 4 | Padronizar a moldura compartilhada | entregue | pendente | `@erp/moldura` 0.3.0 |
| 5 | Adicionar testes no navegador | substituída; a base testa as actions pelo caminho do navegador | pendente | `repos/verificacao` |
| 6 | Retomar a implementação do @erp/nucleo | entregue | pendente | `@erp/nucleo` 0.3.2, 60 testes, ADR-0010 |
| 7 | Construir o shell real | entregue | pendente | `repos/erp-shell` |
| 8 | Construir a zona inicial e stub de domínio | entregue | pendente | `erp-zona-1`, `erp-zona-2`, `erp-dominio-stub` |
| 13 | Criar o mapa central de zonas | entregue (`zonas.json`); resíduo foi para a #14 | pendente | `repos/erp-shell/zonas.json` |
| 15 | Migrar para Next.js 16 e App Router | entregue | pendente | Next 16.3.4 + `proxy.ts` |
| 16 | Documentar riscos e decisões em aberto | entregue | pendente | ADR-0009, ADR-0010, `alvo.md` §6 |
| 17 | Validar a base genérica BFF + Multi-Zones *(nova)* | **criar já fechada**, para registro (texto em §3) | pendente | ADR-0009; `repos/verificacao` 26/26; `GATE_STATUS.md` |

As quatro atividades do anexo de `docs/historico/revisao/2026-09-15-revisao-base-generica.md` não
serão criadas: o trabalho delas está na #17.

## 3. Textos prontos para colar

### #17 — criar já fechada

```
Título:

[Dev/Front] Validar a base genérica BFF + Multi-Zones — shell, duas zonas e gestão de acesso

🎯 Objetivo*

Provar que a arquitetura BFF + Multi-Zones funciona sem código de domínio no núcleo, com sessão pelo shell, gestão de acesso federada e toast entre zonas.

✅ Critérios de Aceitação

Shell é o único escritor da sessão; zonas só leem

Módulo negado responde 404 e some do menu, sem novo login

Toast disparado numa zona aparece uma vez na outra

Toda Server Action recusa quem não tem o módulo, sem Origin ou com sessão expirada

Queda de um domínio degrada só o bloco dele

🧪 Casos de Teste

Cenário 1: node --test repos/verificacao/*.test.mjs → 26/26

Cenário 2: roteiro manual docs/ROTEIRO-DE-VERIFICACAO.md, itens A1–A11

🎨 Referência de Design

Link: N/A

📋 Caso de Uso

Link: docs/design-bff/comum/docs/adr/0009-base-generica.md
```

### #18 — criar em andamento

```
Título:

[Dev/Front] Centralizar a telemetria das zonas no shell — gateway OTLP com limites

🎯 Objetivo*

Receber os traces das zonas por um único ponto no shell, autenticado pela sessão, com limite de tamanho e de taxa, e repassá-los ao coletor OTLP.

✅ Critérios de Aceitação

POST /api/otel/v1/traces sem sessão responde 204 e descarta o lote

Lote acima de 256 KB responde 413, inclusive sem Content-Length

Mais de 60 lotes por minuto do mesmo usuário responde 429 com Retry-After

Ao menos uma zona envia traces pelo gateway

O gateway passa por gate (revisor, challenger, auditor)

🧪 Casos de Teste

Cenário 1: usuário logado envia um lote válido; o coletor recebe e a resposta é 204

Cenário 2: corpo de 300 KB em chunks sem Content-Length; resposta 413 sem ler tudo em memória

Cenário 3: 61 lotes em um minuto; o 61º recebe 429

🎨 Referência de Design

Link: N/A

📋 Caso de Uso

Link: N/A
```

## 4. Histórico de revisões

| Data | O que mudou |
|---|---|
| 2026-09-15 | Primeiro catálogo (16 atividades) |
| 2026-09-21 manhã | Critério do humano: encerrar o defasado. Fechar 1, 2, 4, 5, 6, 7, 8, 13, 15, 16; reescrever 3 e 9; criar a 17 |
| 2026-09-21 tarde | #3 em andamento (implementada, sem gate); #6 com 0.3.2; #14 ganha as regras do ADR-0010; #17 com 26/26; criar a #18. Catálogo saiu de `MANUTENCAO-GITLAB.md` para este arquivo |
| 2026-09-21 noite | #9 em andamento (adaptador Redis no núcleo 0.4.0); #14 ganha o hook `pre-push`; #10 em andamento (núcleo 0.5.0, ADR-0011) |
