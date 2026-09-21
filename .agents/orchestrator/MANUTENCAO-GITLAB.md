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

## 3. Catálogo das atividades (revisado em 2026-09-21)

Critério do humano em 2026-09-21: **encerrar o que ficou defasado, em vez de continuar ajustando.**
Com a PoC `apps/` congelada (ADR-0009), as atividades dela fecham por substituição. As da fatia 1
fecham pela entrega da base genérica em `repos/`. Ficam abertas só as que descrevem trabalho
que ainda falta na base nova, com o escopo reescrito.

| # | Título no GitLab | Ação proposta | Evidência |
|---|---|---|---|
| 1 | Finalizar a validação da prova de conceito | **Fechar** — substituída | PoC congelada; validação passou à base nova (gate da base em `GATE_STATUS.md`) |
| 2 | Corrigir o encerramento do SSE | **Fechar** — substituída | D1 encerrado por substituição; SSE da base nova é a #11 |
| 3 | Tratar zonas travadas | **Reescrever e manter aberta**: "Isolar a falha de zona no shell da base" | a base nova não tem página própria para zona fora (`atual.md` §8, `alvo.md` §6) |
| 4 | Padronizar a moldura compartilhada | **Fechar** — entregue | `@erp/moldura` 0.2.0: menu com `aria-current`, um `<h1>`, host de toast, flash |
| 5 | Adicionar testes no navegador | **Fechar** — substituída | suíte da PoC; a base nova testa as actions pelo caminho do navegador (`Next-Action`) |
| 6 | Retomar a implementação do @erp/nucleo | **Fechar** — entregue | `@erp/nucleo` 0.3.0: registro de destinos, sessão leitor/escritor, porta de acesso, `/shell` |
| 7 | Construir o shell real | **Fechar** — entregue | `repos/erp-shell` |
| 8 | Construir a zona inicial e stub de domínio | **Fechar** — entregue | `repos/erp-zona-1`, `erp-zona-2`, `erp-dominio-stub` (A, B, C, plataforma) |
| 9 | Implementar sessão e autorização no servidor | **Reescrever e manter aberta**: "Trocar login e store de desenvolvimento por OIDC e Redis" | cookie opaco, store compartilhado, escritor único e autorização por módulo já entregues; faltam OIDC, Redis e renovação de token (ADR-0009, decisão 3) |
| 10 | Implementar composição por fragmentos | Manter aberta | não iniciado |
| 11 | Centralizar o tempo real no shell | Manter aberta; tirar a dependência da #2 | não iniciado |
| 12 | Publicar o pacote visual @erp/ui | Manter aberta | depende da medição de duplicação de bundle |
| 13 | Criar o mapa central de zonas | **Fechar** — entregue | rewrites gerados de `zonas.json`; menu e rotas vêm dos manifestos registrados. O resíduo (origens vindas do domínio de acesso) foi para a #14 |
| 14 | Definir estratégia de publicação e compatibilidade | Manter aberta; acrescentar remotos e submódulos dos 5 repositórios novos e o mapa de zonas vindo do domínio de acesso | `repos/README.md` |
| 15 | Migrar para Next.js 16 e App Router | **Fechar** — entregue | a base é Next 16.3.4 + App Router + `proxy.ts` |
| 16 | Documentar riscos e decisões em aberto | **Fechar** — entregue | ADR-0009 (decisões e consequências), limitações 11 e 12, `alvo.md` §6, `atual.md` §8 |
| 17 (nova) | Validar a base genérica BFF + Multi-Zones | **Criar já fechada**, para registrar o trabalho | ADR-0009; `repos/verificacao` 23/23; gate da base |

As quatro atividades do anexo de `docs/revisao/2026-09-15-revisao-base-generica.md` **não serão criadas**:
todo o trabalho delas foi entregue e está registrado na #17 (núcleo genérico, gestão de acesso,
contrato shell ↔ zonas, revisão do harness e dos documentos).

## 4. Pendências de aviso

Avisos já dados ao humano e ainda não confirmados. Remova a linha quando o humano confirmar.

| Data | Aviso |
|---|---|
| 2026-09-21 | Revisão completa do catálogo (§3): fechar 1, 2, 4, 5, 6, 7, 8, 13, 15, 16; reescrever 3 e 9; manter 10, 11, 12, 14; criar a 17 já fechada. Os avisos de 2026-09-15 foram absorvidos por esta revisão |
