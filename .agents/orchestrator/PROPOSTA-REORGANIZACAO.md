# Proposta de reorganização — documentação e código

> Avaliação pedida pelo humano em 2026-09-21, depois da saída do challenger do gate do shell.
> Cada item diz o problema medido, a proposta e o custo.
>
> **Decisões do humano (2026-09-21):** C1 — evitar duplicação e manter consistência → opção A
> (`@erp/nucleo/app`), confirmada com o `arquiteto-mfe` antes de codar; C3 — mover para `base/` junto
> com o resto; D8 — só o aviso no topo (D6). Execução: itens que não tocam o que o auditor usa
> (`repos/scripts`, `base/verificacao`, `.agents/`) primeiro; C3 e D7 depois que ele terminar.

## 1. Diagnóstico (medido, não opinado)

| # | Problema | Evidência |
|---|---|---|
| P1 | **Código copiado em 4 apps.** `lib/pagina.ts` (113 linhas, sessão, módulo, flash, envelope de Server Action) é idêntico no shell e nas 3 zonas; também `lib/indisponivel.tsx` e `app/global-error.tsx`. `scripts/registrar-manifesto.ts` e o `proxy.ts` das zonas diferem só no nome da zona | `md5sum`: 4 cópias iguais de cada um |
| P2 | **Um bug entra 4 vezes.** O fail-open de `exigirModulo` (achado grave do revisor) foi aplicado nas 4 cópias por commits separados; a correção também terá de ser | `bac6d37`, `8182515`, `6569790`, `a63b995` |
| P3 | **Divergência silenciosa.** O `proxy.ts` do shell deixou de usar `criarProxy` e perdeu `form-action` e `img-src` da CSP | `reviewer_shell_1` achado 2 |
| P4 | **Nenhum repositório tem README.** Quem abre `repos/erp-zona-2` não sabe o que é nem como testar | `ls repos/erp-*/README.md` vazio |
| P5 | **Documentação de desenho enterrada e com o caso antigo.** `docs/desenho/bff/` tem 3 níveis e 20 arquivos; o caso "pedidos" (que o ADR-0009 rebaixou a ilustração) aparece ~240 vezes, 35 só em `06-seguranca.md` | `grep -ci pedido` |
| P6 | **O manual de quem escreve código está escondido e desatualizado.** `AGENTS.md` mora em `docs/desenho/bff/`, não na raiz, e manda rodar `npm ci`/`npm run test:vazamento`, que não existem na base | `AGENTS.md` §Comandos |
| P7 | **Documentos duplicados ou rascunho.** `mfe/multizone.md` e `mfe/limitações-mfe-multizone.md` são duas listas de limitações; `mfe/ideia-mfe` é rascunho sem extensão; `PENDENCIAS.md` (417 linhas) repete o que `alvo.md` §6 resume | leitura |
| P8 | **Histórico misturado com o vivo.** `docs/historico/superpowers/` (4.700 linhas de planos encerrados), `docs/historico/revisao/`, `MULTI_ZONES_RESEARCH.md` ao lado de `docs/arquitetura/` | `wc -l` |
| P9 | **`repos/` mistura submódulos com ferramentas da base** (`scripts/`, `verificacao/`, `docker-compose.yml`, `.verdaccio/`) | `ls repos` |
| P10 | **`.agents/` tem 61 pastas**, quase todas de gates encerrados da PoC | `ls .agents \| wc -l` |

## 2. Proposta para o código

### C1. Um "kit de app" publicado, no lugar das cópias (resolve P1, P2, P3) — ❓ onde mora

O que as 4 apps copiam vira pacote, e cada app fica só com o que é dela (rotas, manifesto,
destinos). Duas opções:

| Opção | Como | Prós | Contras |
|---|---|---|---|
| **A (recomendada)** | subpath novo `@erp/nucleo/app` com `criarPaginas(nucleo)` → `{ sessaoDaPagina, exigirModulo, dadosDaMoldura, acaoProtegida, flash }`, e `registrarManifesto()` | uma correção, uma versão, um gate; o lockstep do núcleo já cobre | o núcleo passa a conhecer `next/headers` e `@erp/moldura` num subpath (como `/proxy` já conhece `next/server`) |
| B | pacote novo `@erp/app` | núcleo continua sem Next | mais um pacote para publicar e versionar |

Antes de escrever: passar pelo `arquiteto-mfe` (regra do projeto) e cobrir com teste a regra
fail-closed que hoje não tem teste nenhum (`reviewer_shell_1`, suspeita 7).

### C2. O shell volta a usar `criarProxy` (resolve P3)

A decisão do shell (sonda, 503, telemetria) vira uma opção de `criarProxy` ou uma função que
roda antes dele, e a CSP sai de um lugar só. Entra na rodada de correção do gate.

### C3. `repos/` só com submódulos (resolve P9) — ❓ vale o custo

Mover `repos/scripts`, `base/verificacao`, `base/docker-compose.yml` e `repos/.verdaccio` para
`base/` na raiz. Custo: atualizar caminhos em `package.json`, README, roteiro, `AMBIENTE.md` e nos
scripts. Ganho: `repos/` passa a significar "os 8 repositórios". Pode esperar.

## 3. Proposta para a documentação

### Estrutura alvo

```
README.md              como rodar e testar (existe)
AGENTS.md              NOVO na raiz: regras para quem escreve código — invariantes, onde
                       colocar cada coisa, comandos reais (pnpm, node --test)
docs/
  README.md            índice: 3 perguntas, 3 lugares (existe)
  arquitetura/         atual.md, alvo.md (existe)
  ROTEIRO-DE-VERIFICACAO.md
  adr/                 os 11 ADRs, tirados de adr/
  desenho/
    bff/               o que hoje está em desenho/bff/ (00–14, CORRECOES)
    mfe/               00-arquitetura, 01-operacao, 02-zonas, limitacoes (fundidas)
  historico/           superpowers/, revisao/, MULTI_ZONES_RESEARCH, ideia-mfe, PENDENCIAS
repos/erp-*/README.md  NOVO em cada repositório: o que é, como testar, de quem depende
.agents/orchestrator/  estado (já reorganizado)
.agents/arquivo/       pastas de agentes de gates encerrados
```

### Ações, em ordem de valor

| # | Ação | Resolve | Custo |
|---|---|---|---|
| D1 | README curto em cada `repos/erp-*` (10–20 linhas: papel, porta, `pnpm test`, dependências) | P4 | baixo |
| D2 | `AGENTS.md` na raiz, reescrito curto: invariantes (os 17), tabela "onde colocar", comandos reais. O atual vai para `docs/desenho/bff/` | P6 | médio |
| D3 | Achatar `docs/design-bff/` em `docs/adr/` e `docs/desenho/{bff,mfe}/` e atualizar os links (inclusive `.claude/agents/*.md`) | P5 | médio |
| D4 | Mover histórico para `docs/historico/` (já planejado) | P8 | baixo |
| D5 | Fundir as duas listas de limitações do Multi-Zones numa só | P7 | baixo |
| D6 | Nos documentos de desenho que usam "pedidos": aviso de uma linha no topo ("o caso Pedidos é ilustração; na base, leia zona 1/zona 2/domínio A"), sem reescrever | P5 | baixo |
| D7 | `.agents/` de gates encerrados → `.agents/arquivo/`, com os caminhos de `GATE_STATUS.md` atualizados | P10 | baixo |
| D8 | ❓ Reescrever os documentos de desenho sem o caso "pedidos" | P5 | alto; recomendo **não** agora |

### Regras que mantêm simples depois

- Um documento, uma pergunta. Se um arquivo responde duas, divide; se dois respondem a mesma, funde.
- Estado curto e atual; o encerrado vai para `historico/` (já em `docs/README.md`).
- Todo repositório tem README; toda decisão estrutural tem ADR; toda armadilha vai para `AMBIENTE.md`.

## 4. Andamento

| Item | Estado |
|---|---|
| D1 READMEs dos 8 repositórios | ✅ feito |
| D2 `AGENTS.md` curto na raiz; o longo virou `docs/desenho/bff/manual-completo.md` | ✅ feito |
| D3 `docs/adr/`, `docs/desenho/{bff,mfe}/`; links recalculados; `.claude/agents/` atualizados; 0 links quebrados | ✅ feito |
| D4 histórico em `docs/historico/` | ✅ feito |
| D5 | ✅ **corrigido:** as duas listas **não eram duplicatas** (uma é do framework, outra de infraestrutura fora da Vercel). Foram renomeadas pelo que são: `limitacoes-do-multizones.md` e `infraestrutura-fora-da-vercel.md` |
| D6 aviso "Pedidos é ilustração" em 16 documentos de desenho | ✅ feito |
| D7 `.agents/` de gates encerrados → `.agents/arquivo/` (58 pastas) | ✅ feito |
| C3 `repos/{scripts,verificacao,docker-compose.yml,.verdaccio}` → `base/` | ✅ feito; compose com `name: repos` para manter os volumes do Verdaccio; `base/verificacao` 30/30 |
| C2 shell para de copiar a CSP | ✅ feito: `politicaDeSeguranca` do núcleo 0.6.0 no `proxy.ts` do shell |
| C1 kit de app `@erp/nucleo/app` | ✅ decidido no ADR-0012 (o núcleo **não** importa a moldura: injeção por `aoNegar`); ⏳ implementar depois do gate |

Os handoffs antigos em `.agents/<agente>/` e o que está em `historico/` mantêm os caminhos da época.

## 4. Ordem sugerida

1. Terminar o gate do shell (auditor em andamento) e corrigir os achados — **C2 entra aqui**.
2. D1, D4, D5, D6, D7 (baratos, sem risco para o código).
3. C1 com o arquiteto e os testes que faltam (resolve o fail-open de uma vez, nas 4 apps).
4. D2, D3.
5. C3 e D8 só se o humano quiser.
