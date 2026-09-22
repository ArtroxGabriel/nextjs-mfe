# Atividades do GitLab — revisão viva

> **Este arquivo é a fonte da verdade sobre o estado de cada atividade do GitLab.** O agente o
> atualiza ao fim de todo gate, task ou decisão; o humano copia para o GitLab e marca a coluna
> "No GitLab?". Regras de quando avisar: `MANUTENCAO-GITLAB.md`.
>
> Última revisão: **2026-09-22 (noite)** (estado reconferido nesta máquina: 60/60 nos dois modos; gate B1+D1 em nova rodada de auditoria; #3, #9, #14, #20 e #21 corrigidas).

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
| 3 | Isolar a falha de zona no shell da base *(era "Tratar zonas travadas")* | gate do shell **aprovado** na iteração 4; `/{zona}/api/health` **implementado** nas 3 zonas e a sonda do shell o usa (B3), ainda sem gate independente (entra no gate B1+D1 iteração 2) | reescrever título; mover para **em andamento**; fechar depois do gate que cobre o B3 | pendente | `erp-zona-1` `677a79c`; `erp-shell` `d7a27a9`; `GATE_STATUS.md` |
| 9 | Trocar login e store de desenvolvimento por OIDC e Redis *(era "Implementar sessão e autorização no servidor")* | cookie opaco, escritor único e autorização por módulo entregues; **Redis ligado** quando `REDIS_URL` existe (60/60 com Redis, conferido de novo em 2026-09-22; gate B1+D1 **reprovado** na iteração 2: vetos V1–V8, correção na fatia K); sessão já tem os campos `refreshToken`/`idToken`/`tokenExpiraEm` (núcleo 0.8.0); **faltam** login OIDC + PKCE com o Keycloak e a renovação com lock (D2, ADR-0013) | reescrever título e critérios; mover para **em andamento** | pendente | ADR-0009 decisão 3; ADR-0013; `GATE_STATUS.md` |
| 10 | Implementar composição por fragmentos | núcleo pronto (`@erp/nucleo` 0.5.0, 18 testes, 16 mutações); falta ligar zona 1 ← zona 2 e bloquear no shell | mover para **em andamento** | pendente | ADR-0011; `erp-nucleo` `1841771` |
| 11 | Centralizar o tempo real no shell | não iniciado | manter; tirar a dependência da #2 | pendente | `alvo.md` §6 (SSE) |
| 12 | Publicar o pacote visual @erp/ui | não iniciado; depende de medir duplicação de bundle | manter | — | `alvo.md` §6 |
| 14 | Definir estratégia de publicação e compatibilidade | submódulos **feitos**; hook `pre-push` que recusa submódulo não enviado **feito** (`base/scripts/checar-envio.mjs`, provado com commit só local); **gate de lockstep do núcleo feito** (`base/scripts/verificar-lockstep.mjs`, no `pre-push`, provado com divergência real); falta registro único ou publicação pelo CI — em 2026-09-22 as duas máquinas alternaram commits só de hash de lockfile, cada um quebrando a instalação da outra; paliativo: `task pacotes:alinhar-hashes` e não commitar hash local | acrescentar critérios: gate de lockstep no CI, registro único, nunca republicar a mesma versão,  checar submódulo não enviado antes do push, mapa de zonas vindo do domínio de acesso | pendente | ADR-0010; `AMBIENTE.md` §1–2; `4eb128b` |
| 19 | Entregar o showcase da base com mocks, Keycloak e Redis *(nova)* | **`task showcase` sobe tudo** (Redis, Keycloak, domínios com dados em JSON gravados, shell e 3 zonas) e `task showcase:conferir` mostra ator × zona; sessão já no Redis; falta login pelo Keycloak (D2) e o roteiro completo (E4, E5) | **criar** (texto em §3) | pendente | `RETOMADA.md` |
| 20 | Migrar as apps para o kit de app e fechar as verificações da spec *(nova)* | **migração feita** nas 4 apps (núcleo 0.8.2, moldura 0.4.0); **B4/B6 feitos** (`base/verificacao/seguranca-estatica.mjs`, 16/16); **B5 feito** (B5a no shell, B5b no núcleo 0.8.0; os tempos de sessão entram com o D2); ponta a ponta 60/60; gate B1+D1 **reprovado** na iteração 2 (vetos V1–V8; correção na fatia K) | **criar** (texto em §3, atualizado) | pendente | ADR-0012; `GATE_STATUS.md` |
| 21 | Evoluir a gestão de acesso para o modelo de referência v2 *(nova)* | **modelo e mock prontos** (G1); **ADR-0014 registrado** (G2, proposto); alinhamento (G3) **só começou** no núcleo 0.8.x: `acessoHttp` tenta `/v2/eu` no destino da v1 e cai para a v1 em qualquer erro, então a v2 ainda não é usada; faltam destino da v2, funcionalidades nos manifestos, papéis e segregação na verificação, e o gate (G4) | **criar** em andamento (texto em §3) | pendente | ADR-0014; `RETOMADA.md` item G |
| 18 | Centralizar a telemetria das zonas no shell *(nova)* — **ampliar para "Trace contínuo sem dado pessoal (núcleo 8)"**: o elemento 8 é núcleo e está ausente (`alvo.md` §6) | gateway e propagação de trace **aprovados no gate do shell** (iteração 4); falta exportar spans (SDK OpenTelemetry, instalação aprovada; B2) | **criar** em andamento (texto em §3) | pendente | `erp-shell` `6de4939`; `alvo.md` §6 (Operação) |

### Lista 2 — refinamento (separada das atuais; não começar agora)

Só começam quando a lista 1 (fases A–E do `RETOMADA.md`) estiver concluída e todas as funcionalidades
basilares estiverem no showcase (#19). Cada uma começa por um **pedido de detalhamento** em `pedidos/`.
Sugestão para o GitLab: criar agora com a etiqueta "refinamento" e o estado "bloqueado — depois do showcase".

| # | Título | Estado real | Ação | No GitLab? |
|---|---|---|---|---|
| F1 | Refinar a arquitetura com design patterns e padrões de arquitetura | espera a lista 1; precisa de detalhamento | criar bloqueada (texto em §3) | pendente |
| F2 | Otimizar desenvolvimento e produção | idem | criar bloqueada | pendente |
| F3 | Tornar o mapa de zonas robusto | idem | criar bloqueada | pendente |
| F4 | Refinar a gestão de acesso | idem | criar bloqueada | pendente |
| F5 | Padronizar os erros | idem | criar bloqueada | pendente |
| F6 | Estruturar a camada de testes | idem | criar bloqueada | pendente |
| F7 | Estruturar os testes de desempenho e segurança | idem | criar bloqueada | pendente |

### Fechar — entregues ou substituídas

| # | Título | Motivo | No GitLab? | Evidência |
|---|---|---|---|---|
| 1 | Finalizar a validação da prova de conceito | substituída pela base; PoC removida | pendente | tag `poc-final`; `73bdc8b` |
| 2 | Corrigir o encerramento do SSE | substituída (era da PoC); SSE da base é a #11 | pendente | `DEFERRED.md` D1 |
| 4 | Padronizar a moldura compartilhada | entregue | pendente | `@erp/moldura` 0.3.0 |
| 5 | Adicionar testes no navegador | substituída; a base testa as actions pelo caminho do navegador | pendente | `base/verificacao` |
| 6 | Retomar a implementação do @erp/nucleo | entregue | pendente | `@erp/nucleo` 0.3.2, 60 testes, ADR-0010 |
| 7 | Construir o shell real | entregue | pendente | `repos/erp-shell` |
| 8 | Construir a zona inicial e stub de domínio | entregue | pendente | `erp-zona-1`, `erp-zona-2`, `erp-dominio-stub` |
| 13 | Criar o mapa central de zonas | entregue (`zonas.json`); resíduo foi para a #14 | pendente | `repos/erp-shell/zonas.json` |
| 15 | Migrar para Next.js 16 e App Router | entregue | pendente | Next 16.3.4 + `proxy.ts` |
| 16 | Documentar riscos e decisões em aberto | entregue | pendente | ADR-0009, ADR-0010, `alvo.md` §6 |
| 17 | Validar a base genérica BFF + Multi-Zones *(nova)* | **criar já fechada**, para registro (texto em §3) | pendente | ADR-0009; `base/verificacao` 26/26; `GATE_STATUS.md` |

As quatro atividades do anexo de `docs/historico/revisao/2026-09-15-revisao-base-generica.md` não
serão criadas: o trabalho delas está na #17.

## 3. Textos prontos para colar

### #3 e #18 — comentário: gate aprovado

```
Gate "Shell novo" aprovado na iteração 4 (revisor, challenger e auditor forense independentes).
Coberto: 503 próprio com Retry-After quando a zona cai ou trava (em menos de 1 s), em qualquer caixa do caminho; nenhum módulo vaza com a gestão de acesso fora (todas as páginas de módulo, inclusive no payload RSC e na navegação do cliente); CSP com nonce novo e imprevisível no shell e nas zonas; gateway de telemetria que descarta lote anônimo, limita tamanho em streaming e taxa; trace propagado do navegador ao domínio.
Três iterações reprovadas antes, cada uma com a correção provada por mutação. Verificação ponta a ponta: 51/51.
Falta na #3: /{zona}/api/health sem tocar domínio. Falta na #18: exportar spans ao coletor (SDK OpenTelemetry).
Evidência: .agents/orchestrator/GATE_STATUS.md; tag gate-shell-aprovado.
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

Renovação de token no shell, proativa e com lock (ADR-0013)

Sessão de 30 min por inatividade, capturada pelos refresh tokens; tempos em variáveis de ambiente (docs/CONFIGURACAO.md)

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
Feito: os 8 repositórios são submódulos (4eb128b); hook pre-push recusa enviar o principal apontando para commit de submódulo que só existe localmente (base/scripts/checar-envio.mjs).

Critérios novos:
- Um único registro de pacotes (ou publicação pelo CI); hoje cada máquina tem o seu Verdaccio e os hashes dos lockfiles divergem
- Nunca republicar o mesmo número de versão (ADR-0010)
- Mapa de zonas vindo do domínio de gestão de acesso
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

Cenário 1: node --test base/verificacao/*.test.mjs → 26/26

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

### #19 — criar

```
Título:

[Dev/Front] Entregar o showcase da base — mocks em JSON, Keycloak e Redis

🎯 Objetivo*

Ter um caso de teste usável que mostra cada funcionalidade basilar da base BFF + Multi-Zones, subido com um comando.

✅ Critérios de Aceitação

Domínios simulados por APIs mock em Node.js com dados em arquivos JSON, com reset por comando

Keycloak e Redis sobem por imagem Docker; realm com os atores ana, bruno, carla e davi

Um comando sobe tudo (imagens, mocks, shell e zonas) e outro derruba

Roteiro com passo e resultado esperado para: login OIDC, sessão entre zonas, módulo negado = 404, fragmento, SSE, toast, zona fora = 503, If-Match, erro { codigo, supportId }, trace

A verificação ponta a ponta roda contra o showcase

🧪 Casos de Teste

Cenário 1: pnpm showcase em máquina limpa (só Docker e Node) → roteiro inteiro passa

Cenário 2: reset dos mocks → dados voltam à semente

🎨 Referência de Design

Link: N/A

📋 Caso de Uso

Link: .agents/orchestrator/RETOMADA.md (fase E)
```

### #20 — criar

```
Título:

[Dev/Front] Migrar as apps para o kit de app — uma cópia só de sessão, módulo e actions

🎯 Objetivo*

Trocar o código copiado nas 4 apps (lib/pagina.ts, indisponível, global-error, registrar-manifesto) pelo kit @erp/nucleo/app e @erp/moldura/servidor, e fechar as verificações da spec que faltam.

✅ Critérios de Aceitação

Shell e 3 zonas usam @erp/nucleo 0.8.2 e @erp/moldura 0.4.0; as cópias foram apagadas (feito)

Timeouts, TTLs e limites saem do código para variáveis de ambiente documentadas em docs/CONFIGURACAO.md (feito, exceto os de sessão, que entram com o OIDC)

Build falha com server-only importado em 'use client'

Teste que recusa DTO sensível como prop de ilha

Guarda contra <Link> entre zonas

Verificação ponta a ponta verde

🧪 Casos de Teste

Cenário 1: md5sum não acha mais arquivos idênticos entre as apps

Cenário 2: mutação fail-open em exigirModulo reprova a suíte (um lugar só)

🎨 Referência de Design

Link: N/A

📋 Caso de Uso

Link: docs/adr/0012-kit-de-app-no-nucleo.md
```

### #21 — criar

```
Título:

[Dev/Front] Evoluir a gestão de acesso — unidades, papéis com escopo e módulos com validação

🎯 Objetivo*

Levar a gestão de acesso da base para um modelo de referência completo e alinhar núcleo, BFFs, zonas, domínios e shell a ele, sem perder os invariantes de segurança.

✅ Critérios de Aceitação

Modelo documentado (docs/gestao-acesso/MODELO.md) e API proposta com contrato OpenAPI e mock rodando (feito)

Acesso efetivo como interseção de condições; papel administrativo não dá acesso a módulo

Segregação de funções: administração × auditoria, ninguém se atribui, quem solicita não valida

Desligamento e convênio vencido cortam o acesso e encerram sessões

Decisão de arquitetura em ADR; zonas declaram funcionalidades; BFF esconde o que a pessoa não pode; domínio consulta decisões

Verificação ponta a ponta cobre papéis e segregação; gate aprovado

🧪 Casos de Teste

Cenário 1: administrador geral sem acesso a um módulo não o vê, mesmo administrando

Cenário 2: gestor de uma unidade recebe 404 ao listar pessoas de outra

Cenário 3: pessoa desligada perde a sessão aberta na próxima requisição

🎨 Referência de Design

Link: N/A

📋 Caso de Uso

Link: docs/gestao-acesso/MODELO.md
```

### F1–F7 — criar bloqueadas (mesmo modelo, uma por atividade)

```
Título:

[Dev/Front] <título da tabela da lista 2>

🎯 Objetivo*

<título>. Começa com um pedido de detalhamento; só implementar depois do detalhamento aprovado.

✅ Critérios de Aceitação

Pedido de detalhamento respondido e registrado em pedidos/

Critérios definidos a partir do detalhamento

Pré-requisito: lista 1 concluída e funcionalidades basilares no showcase (#19)

🧪 Casos de Teste

A definir no detalhamento

🎨 Referência de Design

Link: N/A

📋 Caso de Uso

Link: .agents/orchestrator/RETOMADA.md (lista 2)
```

O que cada pedido de detalhamento precisa responder está na tabela da lista 2 do `RETOMADA.md`.

## 4. Histórico de revisões

| Data | O que mudou |
|---|---|
| 2026-09-15 | Primeiro catálogo (16 atividades) |
| 2026-09-21 manhã | Critério do humano: encerrar o defasado. Fechar 1, 2, 4, 5, 6, 7, 8, 13, 15, 16; reescrever 3 e 9; criar a 17 |
| 2026-09-21 tarde | #3 em andamento (implementada, sem gate); #6 com 0.3.2; #14 ganha as regras do ADR-0010; #17 com 26/26; criar a #18. Catálogo saiu de `MANUTENCAO-GITLAB.md` para este arquivo |
| 2026-09-21 noite (gate 2) | #3: gate 2 reprovado e corrigido, falta o 3; #18: propagação de trace feita |
| 2026-09-21 noite (decisões do humano) | sessão de 30 min; práticas como "contrato só cresce" só documentadas, fora dos critérios da #14; PoC provada, a #19 não será criada |
| 2026-09-21 noite (gate do shell) | #3 e #18: gate 1 reprovado, correção feita, falta o gate 2 |
| 2026-09-21 noite (revisão de premissas) | #18 ampliada para o núcleo 8 (trace); #14 recupera o gate de lockstep; #3 ganha o health check; #19 proposta para as perguntas originais da PoC |
| 2026-09-21 noite | #9 em andamento (adaptador Redis no núcleo 0.4.0); #14 ganha o hook `pre-push`; #10 em andamento (núcleo 0.5.0, ADR-0011); #3 e #18 recebem o bloqueio do revisor; textos prontos para #3, #9, #10, #14 e #18 |
| 2026-09-22 | Plano com objetivo final (showcase com mocks JSON, Keycloak e Redis): criar #19 e #20; lista 2 separada com F1–F7 (refinamento arquitetural, otimização, mapa robusto, gestão de acesso, erro, testes, desempenho e segurança), bloqueadas até o showcase; #3 com gate 3 em andamento |
| 2026-09-22 (tarde) | Sessão por inatividade e regra "parâmetro é configuração documentada": #9 e #20 ganham critérios; gate 3 do shell reprovado e corrigido; ADR-0013 proposto |
| 2026-09-22 (noite) | Gate do shell **aprovado** (iteração 4): #3 falta só o health; #18 faltam só os spans. Taskfile adotado; SSO do showcase endurecido; relatório de segurança (B6) |
| 2026-09-22 (madrugada) | #20 migração feita; #9 Redis ligado nas apps; #19 `task showcase` completo com Redis; docs de responsabilidades (`docs/RESPONSABILIDADES.md`) |
| 2026-09-22 (madrugada, 2) | Criar #21 (gestão de acesso v2: modelo e mock prontos; falta ADR-0014 e alinhamento) |
| 2026-09-22 (noite, 2) | Gate B1+D1 iteração 2 **reprovado** (auditor Opus, vetos V1–V8): #9 e #20 continuam em andamento; comentar o bloqueio no GitLab |
| 2026-09-22 (noite) | Reconferido nesta máquina: 60/60 com arquivo e com Redis. #3 com o health implementado; #20 com B4/B6 e B5 feitos e texto no núcleo 0.8.2; #21 com ADR-0014 e G3 só iniciado; #9 com campos OIDC na sessão; #14 com a alternância de hash entre máquinas. Gate B1+D1 iteração 1 considerada rasa; iteração 2 com auditor Opus |
