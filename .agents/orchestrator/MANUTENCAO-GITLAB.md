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
