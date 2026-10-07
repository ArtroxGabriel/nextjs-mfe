# C3: mapa de zonas vivo e gateway híbrido

> **Para agentes:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, task por task. Passos com `- [ ]`. Cada task de código traz a tabela de **mutações declaradas**: o worker roda todas antes de pedir a revisão e registra no relatório qual teste pegou cada uma (regra do humano, 2026-10-07, `LEIA-PRIMEIRO.md`).

**Objetivo:** uma zona nova entra sem editar arquivo do shell nem reiniciá-lo, e uma zona travada devolve a página de indisponível da base, com `supportId`, dentro de `ERP_ZONA_TETO_MS`.

**Decisões:** ADR-0015, aceito com o pacote recomendado (humano, 2026-10-07): H1 i (mapa relido com TTL), H2 h (híbrido), H3 i (registro de rota na gestão de acesso), H4 i (credencial de serviço do shell só para ler o mapa), H5 i (teto até o primeiro byte, corte por silêncio depois), H6 i (o `zonas.json` sai). Medição de custo no pedido `pedidos/2026-10-07-c3-mapa-de-zonas.md`.

**Arquitetura em uma linha por peça:**
- a gestão de acesso guarda `{ id, origem, registradaEm }` de cada zona; só `svc.{id}` grava a própria rota e só `svc.shell` lê o mapa;
- cada zona registra a própria origem no deploy, lida de `ERP_ZONA_ORIGEM_INTERNA`;
- o shell lê o mapa pelo próprio registro de destinos, valida cada origem contra `ERP_ZONAS_ORIGENS_PERMITIDAS`, guarda o último mapa bom em memória e no Redis e relê a cada `ERP_MAPA_ZONAS_TTL_MS`;
- o `proxy.ts` decide por requisição: documento vai para o gateway interno do shell, que tem teto próprio e página da base; o resto vai por `NextResponse.rewrite` para a origem do mapa.

**Desvio do ADR-0015, registrado na Task 5:** o ADR previa `nucleo.zonas.listar()` em `@erp/nucleo/shell` (fatia 2). O registro de destinos do núcleo já aceita `credencial: 'servico'` (`repos/erp-nucleo/src/interno/destinos.ts:113`) e o shell já declara os próprios destinos (`repos/erp-shell/lib/nucleo.ts`). Ler o mapa por um destino do shell cumpre o invariante 4 sem núcleo novo, sem versão nova e sem lockstep.

## Restrições

- Invariantes do `AGENTS.md`, em especial 4 (saída só por destino declarado; a nova exceção do gateway entra na N8 com motivo), 10 (nada alcançável sem cookie, inclusive a rota interna do gateway), 12 (erro normalizado com `supportId`), 13 (sem cache de payload protegido; o mapa não tem dado de usuário), 15 (só o shell grava sessão e a chave do mapa) e 17 (o código da zona não declara origem).
- Toda variável nova vai para `docs/CONFIGURACAO.md` no mesmo commit, com padrão seguro: `ERP_MAPA_ZONAS_TTL_MS`, `ERP_ZONAS_ORIGENS_PERMITIDAS`, `ERP_ZONA_ORIGEM_INTERNA`, `ERP_ZONA_OCIOSIDADE_MS`; `ERP_ZONA_TETO_MS` ganha a semântica nova para documentos.
- Nenhuma instalação. O gateway usa `node:http` e `node:https` do Node, não `fetch`: com `fetch`, o Node descomprime a resposta e o Next não recomprime a de um route handler (medido: 75 KB em vez de 4 KB).
- Comandos pelo `Taskfile.yml`; tarefa nova entra nele com `desc`.
- Commits sem rodapé de coautoria (hook `no-ai-authorship`). Submódulo enviado antes do principal.
- Documentos sem travessão, sem `·` ou `→` concatenando itens e sem emoji; parágrafo numa linha só.

## Mapa das tasks

| Task | Repositório | Entrega | Depende de |
|---|---|---|---|
| 1 | erp-dominio-stub | rotas do mapa na gestão de acesso | nada |
| 2 | zonas e principal | cada zona registra a própria rota ao subir | 1 |
| 3 | erp-shell | módulo do mapa vivo, com testes de unidade, ainda sem ligar | 1 |
| 4 | erp-shell e principal | proxy híbrido, gateway, saída do `rewrites()` e do `zonas.json`; ponta a ponta | 2, 3 |
| 5 | principal | N8, `AGENTS.md`, documentos, configuração | 4 |
| 6 | principal | medição contra as zonas reais, verificação final e gate | 5 |

### Task 1: rotas do mapa na gestão de acesso (erp-dominio-stub)

**Arquivos:** `repos/erp-dominio-stub/src/gestao-acesso-v2/servidor.mjs`, `repos/erp-dominio-stub/src/base.mjs` (marcador de rota), `repos/erp-dominio-stub/test/gestao-acesso-v2.test.mjs`, `repos/erp-dominio-stub/contratos/gestao-acesso-v2.openapi.yaml`, a semente em `repos/erp-dominio-stub/dados/semente/gestao-acesso-v2.json` (lista `zonas` vazia).

**Interfaces produzidas:**
- `POST /v2/zonas/{id}/rota`, corpo `{ origem }`. Só `Bearer svc.{id}`; outro serviço ou pessoa: 403 `OPERACAO_NAO_PERMITIDA`; sem credencial: 401. `id` fora de `^[a-z0-9][a-z0-9-]*$` ou reservado (`api`, `login`, `erro-de-zona`, `_next`, e qualquer `{reservado}-static`): 422 `ZONA_INVALIDA`. `origem` que não seja `http:` ou `https:` com host, ou que traga credencial, caminho diferente de `/`, query ou fragmento: 422 `ORIGEM_INVALIDA`. Sucesso: 200 `{ id, origem, registradaEm }`, grava e registra o evento de auditoria `ROTA_DE_ZONA_REGISTRADA` com `{ zona, origem }`. Registrar de novo a mesma zona substitui a origem.
- `DELETE /v2/zonas/{id}/rota`. Só `svc.{id}`. 204, evento `ROTA_DE_ZONA_REMOVIDA`. Zona sem rota: 404.
- `GET /v2/zonas`. Só `Bearer svc.shell`; outro serviço ou pessoa: 404 (o mapa não existe para quem não é o shell). 200 com `[{ id, origem, registradaEm }]`.
- As três rotas admitem token de serviço também com `IDP_EMISSOR` (modo JWT), como o registro de manifesto: generalizar o marcador `REGISTRO_DE_MANIFESTO` de `base.mjs` para um marcador de rota de serviço (por exemplo `ROTA_DE_SERVICO`), mantendo o comportamento atual do manifesto. É o escopo mínimo do H4: no mock, a credencial do shell é `svc.shell`; a credencial real de cliente no provedor OIDC fica para o G5.

- [ ] Testes que reprovam, em `gestao-acesso-v2.test.mjs`, um por comportamento acima, inclusive: `svc.zona1` não grava a rota de `zona2`; pessoa com papel de administrador não grava nem lê; `svc.zona1` não lê o mapa; origem `http://127.0.0.1:3001/x`, `http://u:s@h`, `javascript:x`, `ftp://h` recusadas; id `api`, `login-static`, `Zona1` recusados; o evento de auditoria aparece; em modo JWT as três rotas aceitam `svc.*` e as rotas antigas continuam recusando.
- [ ] Implementar; `cd repos/erp-dominio-stub && pnpm test` verde.
- [ ] Contrato OpenAPI atualizado com as três rotas.
- [ ] Mutações declaradas (rodar, registrar, reverter):

| # | Mutação | Teste que precisa reprovar |
|---|---|---|
| M1 | gravar sem comparar `svc.{id}` com o id da URL | outro serviço não grava a rota alheia |
| M2 | `GET /v2/zonas` aceitar qualquer `svc.*` | só o shell lê o mapa |
| M3 | aceitar origem com caminho | origem com caminho recusada |
| M4 | aceitar origem com credencial | origem com credencial recusada |
| M5 | não checar id reservado | id reservado recusado |
| M6 | não registrar o evento de auditoria | evento aparece |
| M7 | marcador de serviço fora das rotas novas | modo JWT aceita `svc.*` nas rotas do mapa |
| M8 | marcador de serviço em todas as rotas | modo JWT continua recusando `svc.*` nas rotas antigas |

- [ ] Commit no submódulo: `feat(stub): zone route registry in access management v2 (C3, ADR-0015)`.

### Task 2: cada zona registra a própria rota (zonas e principal)

**Arquivos:** `repos/erp-zona-1/scripts/registrar-rota.ts`, `repos/erp-zona-2/scripts/registrar-rota.ts`, `repos/erp-zona-acesso/scripts/registrar-rota.ts`, o `package.json` de cada uma (script `registrar-rota`), `base/scripts/ambiente.mjs` e o teste dele, `Taskfile.yml` se precisar de tarefa nova, `base/verificacao/saida-de-rede.mjs` (o script novo é exceção do mesmo tipo do `registrar-manifesto.ts`).

**Interfaces:**
- Consome: `POST /v2/zonas/{id}/rota` da Task 1.
- Produz: ao subir a base, as três zonas aparecem em `GET /v2/zonas` com as origens locais.

- [ ] Script `registrar-rota.ts` no mesmo padrão do `registrar-manifesto.ts` (origem fixa da gestão de acesso em `ACESSO_URL`, `redirect: 'manual'`, timeout, sai com código 1 se não for 200). Lê a origem de `ERP_ZONA_ORIGEM_INTERNA`, com padrão local da porta da zona (`http://127.0.0.1:3001`, `:3002`, `:3003`), e o token de `ERP_TOKEN_SERVICO`, com padrão `svc.<id>`. O id vem do próprio pacote (para a zona de acesso, `acesso`), nunca do ambiente: o código da zona não declara origem (invariante 17), só o ambiente de deploy.
- [ ] `ambiente.mjs`: rodar `registrar-rota` de **todas** as zonas (inclusive a de acesso, que não tem manifesto), depois que a gestão de acesso sobe e antes do shell receber tráfego; `ERP_ZONA_ORIGEM_INTERNA` entra na lista de inclusão do ambiente de cada zona. Teste em `ambiente.test.mjs`.
- [ ] N8: os três scripts novos entram como exceção com o mesmo motivo do registro de manifesto; o teste que fixa a lista muda junto.
- [ ] `task verificar:redis` continua verde (o shell ainda usa o `zonas.json` nesta task; a rota registrada só é conferida por um teste novo em `base.test.mjs`: depois da subida, `GET /v2/zonas` com `svc.shell` traz as três zonas).
- [ ] Mutações declaradas:

| # | Mutação | Teste que precisa reprovar |
|---|---|---|
| M1 | `ambiente.mjs` registra a rota só das zonas com manifesto | as três zonas no mapa depois da subida |
| M2 | o script lê o id do ambiente | teste de unidade do script ou da N8 que fixa a forma |
| M3 | o script segue redirecionamento | N8 |

- [ ] Commits: um por zona (`feat(zona): register own route at deploy (C3)`), depois o principal com ambiente, N8, teste e ponteiros.

### Task 3: módulo do mapa vivo no shell, sem ligar (erp-shell)

**Arquivos:** criar `repos/erp-shell/lib/mapa-zonas.ts` e `repos/erp-shell/test/mapa-zonas.test.mjs`; modificar `repos/erp-shell/lib/nucleo.ts` (destino `mapa-zonas` e `tokenDeServico`), `repos/erp-shell/lib/configuracao.ts` (leitura das variáveis novas).

**Interfaces produzidas** (as Tasks 4 e 5 dependem destes nomes):

```ts
export type ZonaDoMapa = { id: string; origem: string; prefixo: string; prefixoEstatico: string; urlSaude: string }
export type FonteDoMapa = () => Promise<readonly { id: string; origem: string }[]>
export type GuardaDoMapa = { ler(): Promise<string | null>; gravar(json: string): Promise<void> }
export type MapaDeZonas = {
  /** Zonas válidas do último mapa bom; relê a fonte quando o TTL venceu, sem bloquear quem chega durante a releitura. */
  zonas(): Promise<readonly ZonaDoMapa[]>
  /** Zona dona do caminho (prefixo ou prefixo estático, sem diferenciar maiúsculas), ou null. */
  encontrar(caminho: string): Promise<ZonaDoMapa | null>
}
export function criarMapaDeZonas(cfg: {
  fonte: FonteDoMapa
  guarda?: GuardaDoMapa
  ttlMs: number
  origensPermitidas: readonly string[]
  agora?: () => number
  registrarFalha?: (motivo: string) => void
}): MapaDeZonas
export function origemPermitida(origem: string, padroes: readonly string[]): boolean
export const mapaDeZonas: MapaDeZonas // instância do shell: fonte = destino 'mapa-zonas', guarda = Redis 'erp:mapa-zonas'
```

**Regras:**
- Fonte: destino `mapa-zonas` do shell, `origem` de `ACESSO_URL`, caminho `/v2/zonas`, `GET`, `credencial: 'servico'`, timeout curto. `tokenDeServico` do shell lê `ERP_TOKEN_SERVICO`, com padrão `svc.shell` só fora de produção.
- Validação de cada entrada, no shell: id no formato e fora das rotas reservadas (reaproveitar `ehRotaReservada`); origem `http:` ou `https:`, sem credencial, caminho `/`, sem query nem fragmento; `host:porta` casando um padrão de `ERP_ZONAS_ORIGENS_PERMITIDAS`. Formato do padrão: lista separada por vírgula de `host:porta`, em que `*` vale qualquer sequência de letras, dígitos, ponto e hífen dentro do host, ou qualquer porta. Padrão de desenvolvimento: `127.0.0.1:*,localhost:*`. Em produção, sem a variável, o shell não sobe. Entrada inválida é descartada e registrada; as válidas seguem.
- TTL: `ERP_MAPA_ZONAS_TTL_MS`, padrão 30000, mínimo 1000, teto 300000. Releitura não bloqueia: quem chega durante ela usa o último mapa bom; uma releitura de cada vez.
- Fonte fora ou resposta inválida: segue o último mapa bom e registra. Boot frio: tenta a fonte; se falhar, tenta a guarda (Redis, chave `erp:mapa-zonas`, gravada só pelo shell a cada leitura boa); se as duas falharem, mapa vazio, e a Task 4 trata caminho com forma de zona como 503 com a página da base.
- `urlSaude` = `{origem}/{id}/api/health`.

- [ ] Testes de unidade que reprovam, com fonte e guarda falsas e relógio controlado: entrada com origem fora dos padrões é descartada e as outras seguem; id reservado descartado; TTL respeitado (não relê antes, relê depois); fonte fora mantém o último bom; boot frio com fonte fora usa a guarda; boot frio sem as duas dá mapa vazio; leituras simultâneas com TTL vencido fazem uma releitura só; `encontrar` casa `/ZONA1/x` e `/zona1-static/a.js` e não casa `/zona10`; `origemPermitida` com `*` não deixa `127.0.0.1.evil:80` casar `127.0.0.1:*`.
- [ ] Implementar; `cd repos/erp-shell && pnpm test` verde. Nada no `proxy.ts` nem no `next.config.ts` muda nesta task.
- [ ] Mutações declaradas:

| # | Mutação | Teste que precisa reprovar |
|---|---|---|
| M1 | não validar origem contra os padrões | origem fora dos padrões descartada |
| M2 | `*` do padrão casando `:` ou `/` | `127.0.0.1.evil` não casa |
| M3 | entrada inválida derruba o mapa inteiro | as válidas seguem |
| M4 | fonte fora zera o mapa | mantém o último bom |
| M5 | sem fallback para a guarda no boot frio | boot frio usa a guarda |
| M6 | releitura em paralelo para cada chamada | uma releitura só |
| M7 | `encontrar` sensível a maiúsculas | `/ZONA1/x` casa |
| M8 | `encontrar` por `startsWith` sem barra | `/zona10` não casa `zona1` |

- [ ] Commit no submódulo: `feat(shell): live zone map module with validation, TTL and last good map (C3)`.

### Task 4: proxy híbrido e gateway (erp-shell e principal)

**Arquivos:** `repos/erp-shell/proxy.ts`, `repos/erp-shell/lib/decisao-proxy.ts`, `repos/erp-shell/lib/zonas.ts` (sai a leitura do `zonas.json`; ficam `ROTAS_RESERVADAS` e `ehRotaReservada`), `repos/erp-shell/lib/saude-zonas.ts` (sonda pelas zonas do mapa), `repos/erp-shell/lib/pagina-erro-zona.ts` (com `supportId`), criar `repos/erp-shell/lib/gateway-zona.ts` e a rota interna `repos/erp-shell/app/%5Fgateway/[...caminho]/route.ts` (pasta com `_` é privada no App Router; `%5F` é o mesmo truque do fragmento da zona 2), `repos/erp-shell/next.config.ts` (sai o `rewrites()`), apagar `repos/erp-shell/zonas.json`, `base/scripts/ambiente.mjs` (sai `zonas.json` de `ENTRADAS_DO_BUILD`), `base/verificacao/base.test.mjs`, uma zona de teste mínima em `base/verificacao/zona-de-teste.mjs`.

**Interfaces:**
- Consome: `mapaDeZonas` da Task 3; zonas registradas pela Task 2.
- Produz: `decidirAcaoDoProxy` passa a receber o `MapaDeZonas` e devolve, além das ações atuais, `{ acao: 'zona-rapida', destino: URL }` e `{ acao: 'zona-documento', caminhoInterno: string }`.

**Regras:**
- **Quem vai para o gateway:** requisição a caminho de zona com método `GET` ou `HEAD`, sem cabeçalho `RSC`, sem `Next-Action` e fora do prefixo estático. O resto de zona (RSC, Server Actions, outros métodos, `/{zona}-static/*`) vai por `NextResponse.rewrite(new URL(caminho + query, zona.origem))`, que é o caminho rápido; o `experimental.proxyTimeout` continua lendo `ERP_ZONA_TETO_MS` para ele.
- **A rota interna:** o documento é reescrito pelo `proxy.ts` para `/_gateway/{caminho original}`. `/_gateway` entra em `ROTAS_RESERVADAS`, e a decisão do proxy responde 404 a qualquer requisição do navegador que comece por `/_gateway` (a reescrita do próprio proxy não passa de novo pelo proxy). Teste ponta a ponta: `GET /_gateway/zona1` direto do navegador dá 404, com e sem cookie.
- **Sessão, renovação, sonda e recusa de `_fragmento`** continuam no proxy, antes da decisão de caminho; o gateway repete a recusa de `_fragmento`.
- **O gateway** (`lib/gateway-zona.ts`), com `node:http` e `node:https` e agente com keep-alive por origem:
  - alvo montado só com a origem do mapa e o caminho original, nunca com cabeçalho;
  - repassa os cabeçalhos da requisição, menos os hop-by-hop (`connection`, `keep-alive`, `transfer-encoding`, `te`, `trailer`, `upgrade`, `proxy-authorization`, `proxy-authenticate`, `host`), e põe `x-forwarded-host`, `x-forwarded-proto` e o `traceparent` do proxy;
  - repassa a resposta como veio, inclusive o corpo comprimido e cada `Set-Cookie` separado, menos os hop-by-hop; `Location` com a origem interna é reescrito para o caminho relativo;
  - **teto:** `ERP_ZONA_TETO_MS` conta até os cabeçalhos da zona chegarem; no estouro, ou com a zona recusando a conexão, responde 503 com a página da base, `supportId`, `cache-control: no-store` e `retry-after`, e destrói a conexão com a zona;
  - **depois do primeiro byte:** `ERP_ZONA_OCIOSIDADE_MS` (padrão 10000) corta a resposta parada, sem página; limite declarado;
  - navegador que fecha a conexão destrói a conexão com a zona;
  - registra a falha com o `supportId` pelo registrador do shell.
- **Mapa vazio** e caminho com forma de zona (`/{id}` com id no formato e não reservado): 503 com a página da base, não 404, para não esconder uma queda da fonte.
- **Saem** o `rewrites()` do `next.config.ts`, o `zonas.json` e as variáveis `ZONA_{ID}_URL` e `ZONA_{ID}_HEALTH_URL` (o mapa manda).

- [ ] Testes de unidade (shell) que reprovam: decisão por tipo de requisição (documento, RSC, `Next-Action`, POST, estático, HEAD); `/_gateway` do navegador dá 404; gateway contra um servidor falso em porta efêmera: repassa gzip sem abrir, repassa dois `Set-Cookie`, tira hop-by-hop, reescreve `Location` interno, põe `x-forwarded-*`, estoura o teto com 503 e `supportId` sem deixar conexão pendurada, corta por ociosidade depois do primeiro byte, solta a zona quando o cliente fecha.
- [ ] Ponta a ponta em `base.test.mjs`:
  - **L9 muda:** zona travada antes dos cabeçalhos dá, no documento, 503 com a página da base e `supportId` dentro do teto (não mais o 500 cru);
  - **L9b:** página com várias chamadas lentas em sequência, sem mandar bytes, também recebe a página no teto;
  - **L9c:** zona que manda os cabeçalhos e trava no meio é cortada por ociosidade; medir e registrar o tempo;
  - **L10:** a zona de teste mínima (`zona-de-teste.mjs`, id `zona9`, porta livre da faixa da base) registra a rota com `svc.zona9`; em até um TTL (com `ERP_MAPA_ZONAS_TTL_MS` curto no teste) `GET /zona9` passa a responder pelo shell sem reiniciá-lo; removida a rota, volta a 404 em até um TTL. O manifesto e o acesso da `zona9` só existem no que o teste precisar.
  - **L11:** origem registrada fora de `ERP_ZONAS_ORIGENS_PERMITIDAS` não roteia.
  - RSC e Server Action de zona continuam funcionando pelo caminho rápido (os testes atuais de navegação e de `If-Match` cobrem; conferir que seguem verdes); C1b segue verde sem mudança.
- [ ] `task verificar:redis`, `CONSTRUIR=1 task verificar:construir` e `task verificar:oidc` verdes.
- [ ] Mutações declaradas:

| # | Mutação | Teste que precisa reprovar |
|---|---|---|
| M1 | documento vai pelo caminho rápido | L9 (página no teto) |
| M2 | RSC vai pelo gateway | decisão por tipo de requisição |
| M3 | `/_gateway` alcançável do navegador | `/_gateway` dá 404 |
| M4 | gateway pede `identity` ou abre o gzip | repassa gzip sem abrir |
| M5 | só o primeiro `Set-Cookie` repassado | dois `Set-Cookie` |
| M6 | sem `x-forwarded-host` | `x-forwarded-*` e o teste de Server Action pelo shell |
| M7 | teto contando o corpo inteiro | L9c ou o teste de ociosidade |
| M8 | estouro do teto sem destruir a conexão da zona | sem conexão pendurada |
| M9 | mapa vazio dá 404 | caminho com forma de zona dá 503 |
| M10 | alvo montado com o `Host` da requisição | alvo só do mapa |
| M11 | gateway sem recusar `_fragmento` | recusa no gateway |

- [ ] Commits: shell (`feat(shell)!: hybrid zone routing, document gateway with base page within the ceiling; zonas.json removed (C3)`), depois o principal com teste, zona de teste, ambiente e ponteiro.

### Task 5: N8, regras e documentos (principal)

- [ ] `base/verificacao/saida-de-rede.mjs`: a exceção da sonda passa a ter o motivo "origens do mapa validado"; nova exceção `erp-shell/lib/gateway-zona.ts`, que só pode usar `node:http` e `node:https`, com o motivo; o teste que fixa a lista muda junto; mutação: tirar o gateway da lista faz a N8 reprovar.
- [ ] `AGENTS.md`: invariante 4 (segunda exceção agora "origens do mapa validado", terceira exceção o gateway); tabela "Onde colocar" ganha a linha "endereço de uma zona: registro de rota no deploy (`registrar-rota.ts`), nunca no código".
- [ ] `docs/CONFIGURACAO.md`: as variáveis novas e a semântica nova de `ERP_ZONA_TETO_MS`; saem `ZONA_{ID}_URL` e `ZONA_{ID}_HEALTH_URL`.
- [ ] `docs/desenho/mfe/01-operacao.md` §2.1 e §4, `02-zonas.md` (criar zona ganha o registro de rota), `docs/arquitetura/atual.md` e `alvo.md` §6, `infraestrutura-alvo.md` (o passo "encaminha pelo mapa" deixa de citar o build).
- [ ] ADR-0015: nota de implementação com o desvio (mapa lido por destino do shell, sem `nucleo.zonas.listar()`) e os números medidos. Adendo curto no ADR-0008 apontando o ADR-0015 e no ADR-0014 sobre a credencial de serviço do shell no mock. Nota no ADR-0011: o fragmento segue com `ZONA2_URL`.
- [ ] `DEFERRED.md`: fechar o D7 e os itens de roteamento do D28; registrar os limites declarados (corte sem página depois do primeiro byte; Server Action em zona travada recebe o erro cru; zona nova pode aparecer numa instância do shell antes da outra, por até um TTL).
- [ ] Varredura de estilo nos documentos tocados (`—`, `·`, `→`, `×`, emoji); parágrafos numa linha só; renderizar com `ghpdf --mermaid-offline` os documentos com diagrama e conferir.

### Task 6: medição, verificação final e gate (principal)

- [ ] Medir contra as zonas reais, com o showcase de pé: p50 e p99 de um documento de zona com o gateway e de uma busca de RSC pelo caminho rápido, com 1 e 4 conexões, e a CPU do processo do shell; registrar no ADR-0015. Ferramenta: o gerador de carga do pedido, como tarefa nova do `Taskfile.yml` (`task medir:gateway`), sem dependência nova.
- [ ] Rodar e registrar: `task test`, `task typecheck`, `task verificar:estatica`, `task scripts:test`, `task verificar:redis`, `CONSTRUIR=1 task verificar:construir`, `task verificar:oidc`, `task showcase:checar`, `task lockstep`.
- [ ] `RETOMADA.md`, `ATIVIDADES.md` (#14 e o comentário do D7 na #11), ledger (`task orquestrador:ledger`).
- [ ] Gate completo (revisor, challenger, auditor), no padrão do `LEIA-PRIMEIRO.md`. O challenger ataca: `/_gateway` direto; registro de origem hostil (outra zona, origem fora dos padrões, origem com caminho); `Host` e `X-Forwarded-*` forjados; zona travada antes e depois do primeiro byte; zona nova e removida sem reiniciar o shell; fonte do mapa fora com o shell quente e com o shell frio. O auditor recebe as tabelas de mutação das Tasks 1 a 4 e os relatórios dos workers.
