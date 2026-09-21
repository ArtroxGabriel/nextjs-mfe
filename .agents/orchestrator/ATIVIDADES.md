# Atividades do GitLab — revisão viva

> **Este arquivo é a fonte da verdade sobre o estado de cada atividade do GitLab.** O agente o
> atualiza ao fim de todo gate, task ou decisão; o humano copia para o GitLab e marca a coluna
> "No GitLab?". Regras de quando avisar: `MANUTENCAO-GITLAB.md`.
>
> Última revisão: **2026-09-21, noite** (revisor do gate do shell pediu mudanças; fragmentos e Redis no núcleo 0.5.0).

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
| 3 | Isolar a falha de zona no shell da base *(era "Tratar zonas travadas")* | falta `/{zona}/api/health` sem tocar domínio (`01-operacao` §5.2); gate 1 **reprovado** (vazamento de módulo com a gestão de acesso fora, `/ZONA2` sem sonda, CSP); **correção feita** (`f3d8803`, 30/30); falta o gate 2 | reescrever título; mover para **em andamento** | pendente | `erp-shell` `6de4939`/`dab5ffd`/`a63b995`; `RETOMADA.md` |
| 9 | Trocar login e store de desenvolvimento por OIDC e Redis *(era "Implementar sessão e autorização no servidor")* | cookie opaco, escritor único e autorização por módulo entregues; **adaptador Redis pronto** (`@erp/nucleo` 0.4.0, 12 testes, 9 mutações pegas), falta ligar nas apps; faltam OIDC e renovação de token | reescrever título e critérios; mover para **em andamento** | pendente | ADR-0009 decisão 3; `erp-nucleo` `3a7b80c`; `alvo.md` §6 |
| 10 | Implementar composição por fragmentos | núcleo pronto (`@erp/nucleo` 0.5.0, 18 testes, 16 mutações); falta ligar zona 1 ← zona 2 e bloquear no shell | mover para **em andamento** | pendente | ADR-0011; `erp-nucleo` `1841771` |
| 11 | Centralizar o tempo real no shell | não iniciado | manter; tirar a dependência da #2 | pendente | `alvo.md` §6 (SSE) |
| 12 | Publicar o pacote visual @erp/ui | não iniciado; depende de medir duplicação de bundle | manter | — | `alvo.md` §6 |
| 14 | Definir estratégia de publicação e compatibilidade | submódulos **feitos**; hook `pre-push` que recusa submódulo não enviado **feito** (`repos/scripts/checar-envio.mjs`, provado com commit só local); falta registro único ou publicação pelo CI | acrescentar critérios: **gate de lockstep do núcleo** (`verificar-lockstep.mjs`, perdido desde a spec de 09/09), registro único, nunca republicar a mesma versão, contrato só cresce (2 minors), checar submódulo não enviado antes do push, mapa de zonas vindo do domínio de acesso | pendente | ADR-0010; `AMBIENTE.md` §1–2; `4eb128b` |
| 18 | Centralizar a telemetria das zonas no shell *(nova)* — **ampliar para "Trace contínuo sem dado pessoal (núcleo 8)"**: o elemento 8 é núcleo e está ausente (`alvo.md` §6) | gateway implementado; gate 1 reprovado (lote anônimo repassado, corpo sem limite em streaming, limitador sem expiração); **correção feita** (`f3d8803`); nenhuma zona envia traces | **criar** em andamento (texto em §3) | pendente | `erp-shell` `6de4939`; `alvo.md` §6 (Operação) |
| 19 | Decidir o destino das perguntas originais da PoC na base *(nova, proposta)* | SSE, cache de cliente, query params e MapLibre numa zona foram provados só na PoC; a base não os refaz e nada registrava isso (`alvo.md` §7.1) | **criar** depois da decisão do humano | pendente | tag `poc-final`; `POC.md` |

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

### #3 — comentário de bloqueio

```
Implementado no erp-shell (6de4939, dab5ffd, a63b995): 503 com Retry-After e página própria quando a zona cai, sonda de saúde por zona com cache de 1 s.

Gate em andamento. O revisor pediu mudanças antes de fechar:
- exigirModulo libera o módulo quando a gestão de acesso está fora do ar (fail-open); tem de negar. Afeta shell e zonas.
- o proxy.ts do shell reimplementou a CSP e perdeu form-action 'self' e img-src.

Próximo: challenger e auditor forense; depois, correção e nova rodada.
Evidência: .agents/reviewer_shell_1/handoff.md
```

### #9 — novo título e critérios

```
Título:

[Dev/Front] Trocar login e store de desenvolvimento por OIDC e Redis

🎯 Objetivo*

Substituir o login sem senha e o store de sessão em arquivo pelos adaptadores de produção, sem mudar o contrato que shell e zonas já usam.

✅ Critérios de Aceitação

Adaptador sessaoRedis no núcleo: leitor na raiz, escritor só em @erp/nucleo/shell (feito: @erp/nucleo 0.4.0)

Shell e zonas usam o Redis em vez do arquivo; a verificação ponta a ponta continua verde

Login por OIDC + PKCE no shell; identidadeDev só em desenvolvimento

Renovação de token no shell, com lock (ADR-0002)

🧪 Casos de Teste

Cenário 1: Redis fora do ar → erro normalizado, nunca "deslogado" silencioso

Cenário 2: sair no shell encerra a sessão em todas as zonas na próxima requisição

🎨 Referência de Design

Link: N/A

📋 Caso de Uso

Link: docs/adr/0002-redis-como-store-de-sessao.md
```

### #10 — comentário de andamento

```
Fatia do núcleo entregue: @erp/nucleo 0.5.0 com criarFragmento (zona consumidora: allowlist, só cookie de sessão, timeout de 2 s, nunca lança) e responderFragmento (zona dona: private/no-store, 204 para qualquer ausência, 404 para navegação direta, 500 para HTML ativo). 18 testes; 16 mutações conferidas.

Decisões no ADR-0011. Falta: rota _fragmento na zona 2, bloco na zona 1, recusa de /{zona}/_fragmento/ no shell e teste ponta a ponta.
```

### #14 — critérios a acrescentar

```
Feito: os 8 repositórios são submódulos (4eb128b); hook pre-push recusa enviar o principal apontando para commit de submódulo que só existe localmente (repos/scripts/checar-envio.mjs).

Critérios novos:
- Um único registro de pacotes (ou publicação pelo CI); hoje cada máquina tem o seu Verdaccio e os hashes dos lockfiles divergem
- Nunca republicar o mesmo número de versão (ADR-0010)
- Mapa de zonas vindo do domínio de gestão de acesso
```

### #18 — comentário de bloqueio (depois de criar com o texto abaixo)

```
Gate em andamento. O revisor pediu mudanças: sem Content-Length o gateway lê o corpo inteiro antes de checar sessão e tamanho; o mapa do limitador de taxa nunca expira entradas. Evidência: .agents/reviewer_shell_1/handoff.md
```

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

Link: docs/adr/0009-base-generica.md
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
| 2026-09-21 noite (gate do shell) | #3 e #18: gate 1 reprovado, correção feita, falta o gate 2 |
| 2026-09-21 noite (revisão de premissas) | #18 ampliada para o núcleo 8 (trace); #14 recupera o gate de lockstep; #3 ganha o health check; #19 proposta para as perguntas originais da PoC |
| 2026-09-21 noite | #9 em andamento (adaptador Redis no núcleo 0.4.0); #14 ganha o hook `pre-push`; #10 em andamento (núcleo 0.5.0, ADR-0011); #3 e #18 recebem o bloqueio do revisor; textos prontos para #3, #9, #10, #14 e #18 |
