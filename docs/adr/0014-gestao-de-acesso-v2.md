# ADR-0014 — Alinhamento à gestão de acesso v2

**Status:** aceito com o adendo 1 (humano, 2026-09-23), inclusive a lacuna declarada até o G5 (sem revogação ativa); proposto em 2026-09-22 pelo `arquiteto-mfe`; **adendo 1** no fim (corte seco, núcleo 0.9.0) · **Afeta:** `@erp/nucleo` 0.8.0–0.9.0, `@erp/contratos`, as 4 apps, `erp-dominio-stub` · **Evolui:** ADR-0009 (decisão 2)

## Contexto

A base genérica usava um modelo simplificado de gestão de acesso (`/v1/modulos-permitidos`, porta 4010), onde cada usuário recebia apenas uma lista de identificadores de módulos (`[{ id, nome }]`).

O modelo de referência da base ([`docs/gestao-acesso/MODELO.md`](../gestao-acesso/MODELO.md)) e seu mock de API v2 ([`repos/erp-dominio-stub/contratos/gestao-acesso-v2.openapi.yaml`](../../repos/erp-dominio-stub/contratos/gestao-acesso-v2.openapi.yaml), porta 4020) introduziram conceitos essenciais:
- **Unidades** (com vigência de convênio) e **Pessoas** (CPF único e imutável, vínculo ativo único);
- **Papéis com escopo** (`admin-geral`, `gestor-unidade`, `gestor-modulo`, auditores);
- **Módulos com catálogo de funcionalidades** declaradas pelas próprias zonas (`POST /v2/modulos/manifesto`);
- **Acesso efetivo** como a interseção de 4 condições simultâneas (pessoa ativa, unidade ativa/vigente, acesso ativo, funcionalidade no perfil);
- **Segregação estrita:** papéis administrativos **não** concedem acesso funcional a módulos;
- **Trilha de eventos e revogação ativa** (`GET /v2/eventos`).

Esta decisão define como o `@erp/nucleo`, as zonas, os domínios e o shell passam a operar com a v2, mantendo intactos todos os 17 invariantes do sistema.

## Decisões

1. **Porta de Acesso e Contratos no `@erp/nucleo`:**
   - `PortaDeAcesso` evolui para refletir o acesso efetivo:
     `modulosPermitidos(): Promise<readonly ModuloEfetivo[]>`, onde `ModuloEfetivo` expõe `{ id: string, perfis: readonly string[], funcionalidades: readonly string[] }`.
     Adiciona método de inspeção do usuário: `obterEu(): Promise<Eu | null>`.
   - `acessoHttp`: atualizado para consultar o endpoint `GET /v2/eu` no destino `gestao-acesso` usando a credencial da sessão do usuário. Mapeia a lista de módulos efetivos e funcionalidades.
   - **Sem cache de permissões no BFF** (Invariante 13): continua sem cache local de payload protegido (decisão D7: medir antes de otimizar).

2. **Granularidade em `exigirModulo` e `acaoProtegida`:**
   - `exigirModulo(modulo: string, funcionalidade?: string)`:
     - Aceita verificação de módulo ou de funcionalidade específica (`modulo, funcionalidade` ou `modulo.funcionalidade`).
     - Se o usuário não possui o módulo ou a funcionalidade no acesso efetivo, lança `NaoEncontrado` (HTTP 404 / `notFound()`), garantindo o Invariante 7 (não revelar a existência de recurso fora do escopo) e o Invariante 16 (verificação em camada 2 em toda página).
   - `acaoProtegida`: suporta parâmetro opcional de funcionalidade para verificar a permissão antes de executar o corpo da Server Action. Negado resulta em `404` via `aoNegar`.

3. **Manifesto das Zonas com Catálogo de Funcionalidades:**
   - O manifesto de cada zona declara formalmente seu catálogo de funcionalidades sob seu namespace (ex.: `zona1.painel`, `zona1.custo`).
   - A função `registrarManifesto()` do `@erp/nucleo` envia `POST /v2/modulos/manifesto` contendo `{ id, nome, funcionalidades }`.
   - **Namespace estrito (Invariante 17):** nenhuma zona declara funcionalidade ou perfil fora do prefixo da própria zona.

4. **Domínios e Decisões de Negócio:**
   - O BFF utiliza `GET /v2/eu` estritamente para UX (esconder menus/botões e retornar 404 para rotas fora de escopo).
   - A autorização de negócio em operações e mutações continua sendo responsabilidade exclusiva do domínio (Invariante 9). O domínio valida a regra internamente ou consultando `POST /v2/decisoes` com credencial de serviço (`svc.<dominio>`).

5. **Shell e Revogação Ativa via Eventos:**
   - O shell consome periodicamente `GET /v2/eventos?desde=<cursor>` da gestão de acesso com credencial de serviço.
   - Eventos de `desligamento`, `suspensao` ou revogação de acesso encerram imediatamente as sessões correspondentes no store de sessão (Redis) via `sessao.encerrar(id)`.
   - Invariante 15 preservado: apenas o shell escreve no store de sessão.

6. **Versionamento e Lockstep:**
   - O núcleo sobe para a versão **0.8.0**, incorporando este ADR e o ADR-0013 (OIDC/PKCE), já que ambos alteram portas e contratos fundamentais.
   - A atualização é aplicada simultaneamente nas 4 apps em lockstep.

## Preservação dos Invariantes

| Invariante | Como é garantido |
|---|---|
| 1 (`access_token` fora do navegador) | `GET /v2/eu` é chamado exclusivamente no servidor pelo BFF; dados de sessão nunca vazam. |
| 4 (Registro de destinos) | Chamadas à gestão de acesso usam `nucleo.destino('gestao-acesso')` com parâmetros declarados. |
| 7 (401/404/403) | Módulo ou funcionalidade sem acesso efetivo responde estritamente com 404 (NaoEncontrado). |
| 8 (Sem placeholder "sem acesso") | Se a funcionalidade não estiver em `eu.modulos[m].funcionalidades`, o elemento de UI não é renderizado. |
| 9 (Domínio decide autorização) | BFF só toma decisão de roteamento e visualização; o domínio valida mutações via `POST /v2/decisoes`. |
| 13 (Sem cache no BFF) | O payload de `GET /v2/eu` não é cacheado em memória ou disco no BFF. |
| 15 (Escrita de sessão só no shell) | Processamento de `GET /v2/eventos` e invalidação de sessão rodam unicamente no processo do shell. |
| 16 (`exigirModulo` em toda página) | `criarPaginas` valida módulo e funcionalidade fina em nível de página e action. |
| 17 (Namespace de perfil/módulo) | Manifesto da zona só aceita funcionalidades iniciadas pelo id da própria zona. |

## Testes Exigidos

1. **Unidade no `@erp/nucleo`:**
   - `acessoHttp`: consome `GET /v2/eu`, mapeia `ModuloEfetivo` e funcionalidades;
   - `exigirModulo`: permite funcionalidade presente, lança `NaoEncontrado` para funcionalidade ausente em módulo existente, mantém fail-closed se o serviço de acesso falhar;
   - `registrarManifesto`: posta para `/v2/modulos/manifesto` e recusa nomes fora do namespace.
2. **Integração no Shell:**
   - Consumo de `GET /v2/eventos` remove chave de sessão no Redis quando evento de revogação/desligamento é recebido.
3. **Ponta a ponta (`base/verificacao`):**
   - Página com restrição de funcionalidade fina (ex: `/zona-1/custos`) retorna 200 para usuário autorizado e 404 para usuário sem a funcionalidade ativa.

## Adendo 1 (2026-09-22) — decisões de implementação do G3

Decisão do `arquiteto-mfe` ao implementar o item G3. Emenda as decisões 1, 2, 3, 5 e 6 acima.

**Achados que motivaram o adendo.** O núcleo 0.8.x tentava `/v2/eu` no destino da v1 e caía para
`/v1/modulos-permitidos` em **qualquer** erro, inclusive `401` de pessoa desligada: duas autoridades, e a mais
permissiva vencia. O mock v2 recusava o token dev com uuid; `/v2/eu` não trazia `nome` para o menu; `obterEu`
carregava CPF e papéis sem consumidor; o manifesto v2 usa funcionalidades relativas (`painel.ver`), não
`zona1.painel`; a unidade parceira da semente tem convênio vencido em 2026-06-30 (o gate dependeria da data).

1. **Corte seco para a v2.** O destino `gestao-acesso` aponta para `ACESSO_URL` (padrão `http://127.0.0.1:4020`)
   só com `GET /v2/eu`. Sem convivência com a v1. Fail-closed: `401` → `SessaoInvalida` (login); módulo,
   funcionalidade ou papel ausente → 404; 5xx, timeout, conexão recusada ou corpo fora do esquema → erro
   ("serviço indisponível"), nunca 404 nem conteúdo. A v1 (4010) sai do gate e é apagada depois do G4.
2. **Porta de acesso:** uma função, `acessoEfetivo()` → `{ modulos: { id, nome, funcionalidades }[], administra }`.
   `obterEu` sai. O que chega à página é o booleano `administra`, nunca a lista de papéis nem o CPF.
3. **Granularidade:** `exigirModulo(modulo, funcionalidade)` com os dois argumentos obrigatórios; id de módulo
   sem ponto. Zona 1: `('zona1','painel.ver')` e `('zona1','relatorios.ver')`; zona 2: `('zona2','tarefas.ver')`
   e a action com `'tarefas.concluir'`. A zona de acesso usa `exigirPapel()` (404 sem papel); o domínio decide o
   resto (invariante 9). `acesso` e `shell.inicio` não são módulos v2: papel não concede módulo. A página `/`
   do shell continua fail-closed por `modulosPermitidos()`.
4. **Menu:** uma entrada por módulo, `prefixo = /<id>` (id do módulo = id da zona = `svc.<zona>`), `rotulo =
   nome`; `/v2/eu` passa a devolver `modulos[].nome` (aditivo). "Gestão de acesso" aparece com `administra`.
5. **Manifesto v2 entra no G3:** a zona declara `{ id, nome, funcionalidades }` com `svc.<zona>`; perfis e
   concessões moram na gestão de acesso. O invariante 17 passa a dizer isso.
6. **Atores:** ana, bruno, carla e davi em todo lugar (realm, `identidadeDev`, domínios, gate), na unidade
   `central` da semente v2, com `sub` fixo igual ao id do usuário no realm. ana: `zona1.padrao` + `zona2.operador`;
   bruno: `zona1.analista`; carla: `zona1.padrao` + papel `admin-geral` (prova a segregação); davi:
   `zona1.padrao`. Os atores próprios da v2 ficam como dados dos testes de regra do stub.
7. **Eventos (decisão 5) adiados para o G5, e são núcleo.** Exigem `sub` no evento, remoção de sessão por
   sujeito, credencial de serviço no shell, cursor gravado só pelo shell e consumidor único. **Até o G5 a base
   não tem revogação ativa**: quem está dentro sai só quando a sessão acaba ou quando a página consulta `/v2/eu`.
8. **D2 casa a pessoa por `sub`** (emenda o ADR-0013): `Sessao.sub` é o `sub` do IdP; o stub em modo JWT
   identifica a v2 por `claims.sub`; o retorno do login chama `/v2/eu` antes de gravar e recusa `401`.
9. **Versões e ordem:** G3 primeiro, contratos **0.4.0** e núcleo **0.9.0**, funcionando com token dev; D2 depois,
   núcleo 0.10.0.

**Testes exigidos** (os marcados † reprovam com a mudança revertida): núcleo — † v2 `401` com v1 disposta a
conceder → nega, zero chamadas a `/v1`; † 5xx/timeout/recusa → erro; † corpo malformado → erro; † só `painel.ver`
pedindo `relatorios.ver` → 404; † `exigirPapel` sem papel → 404; † nada serializado contém CPF ou nome de papel.
Stub — † `dev.ana.<uuid>` → 200; manifesto com `id` ≠ serviço → 403. Estático — † funcionalidade usada pela zona
tem de estar no manifesto dela. Gate — † v1 no ar e v2 fora → serviço indisponível; † carla vê `/acesso` e recebe
404 em `/zona2`; † revogar davi em `zona1` → 404 na requisição seguinte; † pessoa desligada → `/login`.

**Em aberto:** se o Keycloak importa `id` de usuário que não é UUID (usar UUID fixo até medir).
