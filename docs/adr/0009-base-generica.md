# ADR-0009 — Base genérica: BFF + Multi-Zones sem domínio no núcleo

**Status:** aceita · **Data:** 2026-09-21 · **Substitui:** decisões 5, 9 e 10 do [ADR-0008](0008-multi-zones-como-base-mfe.md) · **Afeta:** [AGENTS.md](../../AGENTS.md), [02](../desenho/bff/02-nucleo.md), [06](../desenho/bff/06-seguranca.md), [11](../desenho/bff/11-testes.md)

## Contexto

Em 2026-09-15 o objetivo foi reformulado: validar uma arquitetura **BFF com Multi-Zones,
com funcionalidades**, em que o caso de uso é só ilustração e nenhuma camada da base é
específica de domínio. A revisão `docs/historico/revisao/2026-09-15-revisao-base-generica.md` mostrou
quatro conflitos com a base da fatia 1: o caso `/pedidos/8821` era critério de aceite, a
topologia era "uma zona, um domínio", o núcleo conhecia `PedidoDTO` e `lerPedido`, e
faltavam gestão de acesso, contrato shell ↔ zonas e sessão servida pelo shell.

As nove decisões da §7 da revisão foram tomadas em 2026-09-21, todas na recomendação.

## Requisitos (N1–N8)

| # | Requisito |
|---|---|
| N1 | A base valida BFF + Multi-Zones com funcionalidades; o caso é ilustração |
| N2 | Topologia mínima: shell, zona 1, zona 2, zona de gestão de acesso |
| N3 | Sessão e autenticação pelo shell; as zonas consomem |
| N4 | Toast global da moldura; zonas disparam toasts que caem no host dela |
| N5 | Gestão de acesso define qual perfil acessa qual módulo e se um módulo é restrito |
| N6 | Cada zona declara as próprias permissões e perfis; sistemas separados, integrados |
| N7 | Cada zona tem um ou mais domínios; o shell também |
| N8 | Núcleo sem domínio; destinos de saída travados no servidor ("CORS de saída") |

## Decisões

| # | Decisão | Razão |
|---|---|---|
| 1 | Validação em `repos/` com **App Router**; a PoC `apps/` fica congelada como evidência | a PoC quebra o invariante 2 por construção (Pages Router serializa props) |
| 2 | Contratos de domínio: pacote do time dono quando mais de uma zona consome; senão **tipos locais na zona** | `@erp/contratos` fica só com contratos de plataforma (erros, manifesto, módulo permitido) |
| 3 | Renovação de token: **endpoint interno do shell** sob pedido da zona | shell continua escritor único; depende das respostas do IdP (PENDENCIAS §4) — **não implementado** |
| 4 | Moldura e toast: pacote **`@erp/moldura`** renderizado por toda aplicação | sem Module Federation; duplicação medida antes de otimizar |
| 5 | Acesso federado: cada zona publica um **manifesto** (módulos, perfis, concessões padrão); a atribuição é central, na zona de gestão de acesso | um lugar de atribuição, catálogos por zona |
| 6 | Módulo não permitido responde **404** | módulo restrito não revela existência; mantém o invariante 8 |
| 7 | Módulos permitidos consultados **a cada renderização** | revogação vale na próxima navegação; medir antes de cachear |
| 8 | Perfil de zona tem **prefixo da zona** e só concede módulo dela; perfis globais são `plataforma.*`, explícitos | um perfil de zona não escala para outra zona |
| 9 | O gate independente passa a ser **da base nova** | a PoC foi congelada |
| 10 | O núcleo troca a porta de dados por um **registro de destinos**: cada aplicação declara origem, modelos de caminho, métodos, credencial e timeout; o núcleo monta a URL | a zona preenche lacunas, não monta URL; destino, método ou caminho fora do registro lança `DestinoInvalido` sem sair da rede |
| 11 | Sessão dividida em **leitor** e **escritor**; escrita e autenticação só em `@erp/nucleo/shell` | a raiz do pacote não entrega nada que grave sessão, e `criarNucleo` ignora `escrita` mesmo com cast; o que impede uma zona de importar `@erp/nucleo/shell` é a verificação estática das zonas |
| 12 | Portas do núcleo: **sessão, identidade, acesso** (mais o registro de destinos, que é configuração) | substitui a decisão 5 do ADR-0008 |
| 13 | Mutação entra na base com **If-Match obrigatório** para PUT/PATCH/DELETE e o POST de exemplo com versão | substitui a decisão 9 do ADR-0008 (fatia somente leitura) |
| 14 | Server Action **devolve o destino** e a ilha `FormularioDeAcao` troca o documento; nenhuma action usa `redirect()` | com JavaScript, `redirect()` numa action busca o destino no processo da zona atual (limitação 11) |

## Como ficou

```
repos/
  erp-contratos      @erp/contratos 0.2.1 — erros, ManifestoDeZona, ModuloPermitido, validarManifesto
  erp-nucleo         @erp/nucleo 0.3.1    — criarNucleo, registro de destinos, leitor de sessão, acesso, criarProxy; /shell: escrita e identidade
  erp-moldura        @erp/moldura 0.3.0   — <Moldura>, host de toast, emitirToast, flash, FormularioDeAcao
  erp-dominio-stub   domínios falsos: A :4001, B :4002, C :4003, plataforma :4004, gestão de acesso :4010
  erp-shell          :3000 — login, sessão (único escritor), gateway pelas zonas, domínio plataforma
  erp-zona-1         :3001 — domínios A e B; módulo livre e módulo restrito
  erp-zona-2         :3002 — domínio C; mutação com If-Match e toast para outra zona
  erp-zona-acesso    :3003 — administra perfil × módulo, restrição e usuário × perfil
  verificacao/       verificação ponta a ponta pelo shell (node --test)
```

## Consequências

- O que o caso provava continua provado, com nomes genéricos: **carla** é administradora de
  acesso e não vê o bloco `custo` do domínio A ("perfil administrativo não concede dado").
- O domínio de gestão de acesso vira dependência de toda página: sem ele, ninguém entra em
  módulo nenhum. Fica no mesmo nível do store de sessão no plano de falha.
- Mudança no registro de destinos é mudança de segurança e passa pelo `revisor-mfe`.
- Continuam fora da base, e são o alvo das próximas rodadas: OIDC, Redis, renovação de
  token (decisão 3), falha isolada de zona no shell, `FragmentoRemoto`, SSE centralizado,
  `@erp/ui`, gate de lockstep, rate limiting e rastreamento entre zonas.
