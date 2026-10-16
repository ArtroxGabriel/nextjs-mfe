# G5: revogação ativa de sessão por `/v2/eventos`

> **Para agentes:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, task por task. Passos com `- [ ]`. Cada task de código traz a tabela de **mutações declaradas**, incluindo mutações de fronteira (`<` contra `<=`, teto, primeiro e último item): o worker roda todas antes de pedir a revisão e registra no relatório qual teste pegou cada uma (regra do humano, 2026-10-07, `LEIA-PRIMEIRO.md`).

**Objetivo:** fechar a lacuna de segurança declarada do ADR-0014 (decisão 5, adendo 1 item 7 e adendo 2): quando uma pessoa é desligada (`PESSOA_DESLIGADA`) ou suspensa (`PESSOA_SUSPENSA`) na gestão de acesso, o shell consome `GET /v2/eventos?desde=<cursor>` com credencial de serviço, em consumidor único e cursor persistido só pelo shell, e remove do store todas as sessões ativas daquela pessoa dentro do intervalo configurado, sem esperar o access token vencer nem uma página da zona consultar `/v2/eu`.

**Decisões:** ADR-0014 (decisão 5, adendo 1 item 7 e adendo 2) e `docs/gestao-acesso/MODELO.md` (§4 e §5). Nenhuma instalação nova.

**Arquitetura em uma linha por peça:**
- a gestão de acesso (`erp-dominio-stub`) restringe `GET /v2/eventos` a `Bearer svc.shell` (inclusive em modo JWT via `ROTA_DE_SERVICO`, como `GET /v2/zonas`), devolvendo `404` para qualquer outro serviço ou pessoa e `401` sem credencial, e inclui `sujeitos: string[]` (`sub` do OIDC e `login` de desenvolvimento, sem repetir e sem expor CPF) nos eventos cujo alvo é uma pessoa;
- o núcleo (`@erp/nucleo` 0.10.5, exclusivo em `@erp/nucleo/shell`) acrescenta `removerPorSujeito(sub: string): Promise<number>` em `EscritorDeSessao` (nos três stores: Redis, arquivo e memória) e `removerSessoesDoSujeito(sub: string): Promise<number>` em `nucleo.sessao` do shell, mantendo índice de chaves de sessão por sujeito fora de `erp:sessao:*` (inacessível pela ACL das zonas no Redis);
- o shell (`erp-shell`) declara o destino `eventos-acesso` (`GET /v2/eventos?desde={desde}`, `credencial: 'servico'`) e mantém o consumidor `revogacaoAtiva` (`lib/revogacao-ativa.ts`), que a cada `ERP_EVENTOS_ACESSO_INTERVALO_MS` adquire lock de consumidor único (`SET NX PX` em `erp:eventos-acesso:lock`), lê o cursor de `erp:eventos-acesso:cursor`, busca os eventos novos, remove as sessões dos `sujeitos` de `PESSOA_DESLIGADA` e `PESSOA_SUSPENSA` (sem derrubar sessão em `ACESSO_REVOGADO`, pois revogação de módulo tira apenas o módulo e mantém a sessão viva na plataforma) e avança o cursor só quando todas as remoções da página têm sucesso;
- o `proxy.ts` do shell dispara a sincronização de `revogacaoAtiva` antes de avaliar a sessão da requisição quando o intervalo venceu, garantindo que a pessoa desligada ou suspensa caia em `/login` (`307` com cookie limpo) mesmo em páginas ou rotas que não consultam `/v2/eu`.

## Restrições

- Invariantes do `AGENTS.md`, em especial 1 (nenhum dado sensível ou CPF em evento ou navegador), 3 (`import 'server-only'` em todo módulo de servidor), 4 (chamada a `/v2/eventos` pelo destino declarado `eventos-acesso` do núcleo, nunca `fetch` solto), 12 (erro normalizado sem vazar detalhe interno), 13 (sem cache de payload protegido) e 15 (remoção de sessão, índice por sujeito, cursor e lock de eventos existem apenas no shell / `@erp/nucleo/shell`, fora do alcance da ACL das zonas `~erp:sessao:*`).
- Toda variável nova vai para `docs/CONFIGURACAO.md` no mesmo commit, com padrão seguro e validação de fronteira: `ERP_EVENTOS_ACESSO_INTERVALO_MS` (padrão `5000`, mínimo `100`, teto `60000`) e `ERP_EVENTOS_ACESSO_LOCK_MS` (padrão `10000`, mínimo `1000`, teto `120000`).
- Núcleo **0.10.5** em lockstep nas 4 apps (`task lockstep`).
- Comandos pelo `Taskfile.yml`.
- Commits sem rodapé de coautoria (hook `no-ai-authorship`).
- Documentos sem travessão, sem `·` ou `→` concatenando itens e sem emoji; parágrafo numa linha só.

## Mapa das tasks

| Task | Repositório | Entrega | Depende de |
|---|---|---|---|
| 1 | erp-dominio-stub | `GET /v2/eventos` restrito a `svc.shell` (inclusive em modo JWT) e `sujeitos` nos eventos de pessoa | nada |
| 2 | erp-nucleo | `removerPorSujeito` nos três stores e `removerSessoesDoSujeito` no shell (núcleo 0.10.5) | nada |
| 3 | erp-shell e zonas | lockstep `@erp/nucleo` 0.10.5 nas 4 apps e módulo `revogacao-ativa.ts` no shell com testes de unidade | 1, 2 |
| 4 | erp-shell e principal | ligação no `proxy.ts` do shell, testes ponta a ponta de revogação ativa e documentos (`CONFIGURACAO.md`, `ADR-0014`, `RETOMADA.md`) | 3 |

### Task 1: `GET /v2/eventos` restrito a `svc.shell` e `sujeitos` no evento (erp-dominio-stub)

**Arquivos:** `repos/erp-dominio-stub/src/gestao-acesso-v2/servidor.mjs`, `repos/erp-dominio-stub/test/gestao-acesso-v2.test.mjs`, `repos/erp-dominio-stub/test/jwt-verificacao.test.mjs`, `repos/erp-dominio-stub/contratos/gestao-acesso-v2.openapi.yaml`.

**Interfaces produzidas:**
- `GET /v2/eventos?desde={seq}` marcada com `ROTA_DE_SERVICO` (aceita token de serviço também quando `IDP_EMISSOR` está definido, como `GET /v2/zonas`).
- Autorização de `GET /v2/eventos`: sem credencial responde `401`; qualquer credencial que não seja `svc.shell` (outro serviço como `svc.zona1`, `svc.idp`, `svc.bff`, ou qualquer pessoa como `admin1`, `auditor1`, `gnorte1`) responde `404` `{ codigo: 'NAO_ENCONTRADO' }` (a rota não existe para quem não é o shell).
- Parâmetro `desde`: inteiro não negativo (`0` por padrão); devolve apenas eventos com `ev.seq > desde` (fronteira estrita `>`, nunca `>=`). Se `desde` não for inteiro `>= 0` (por exemplo negativo ou texto não numérico), responde `422` `{ codigo: 'CURSOR_INVALIDO' }`.
- Enriquecimento de sujeito em `registrar(tipo, autor, alvo, extra)`: quando `alvo` é o `id` de uma pessoa cadastrada (`pessoa(alvo)` existe), o evento publicado em `estado.eventos` inclui `sujeitos: string[]` contendo os identificadores de sessão daquela pessoa (`[p.sub, p.login].filter(Boolean)` sem duplicatas), sem incluir CPF.
- Em `jwt-verificacao.test.mjs`: `GET /v2/eventos` entra no conjunto `MANIFESTO` (rotas de serviço com teste dedicado em modo JWT), mantendo a recusa `401` para `svc.idp`, `svc.zona1` e `svc.bff` quando o token não é admitido ou `404` quando outro serviço válido tenta ler `/v2/eventos`, e provando que `svc.shell` recebe `200` em modo JWT.

- [ ] **Passo 1: testes que reprovam** em `gestao-acesso-v2.test.mjs` e `jwt-verificacao.test.mjs`:
  - `GET /v2/eventos`: sem credencial `401`; com `svc.zona1`, `svc.idp`, `admin1`, `auditor1`, `gnorte1` recebe `404`; só `svc.shell` recebe `200`;
  - `desde`: `desde=0` traz todos (`seq >= 1`), `desde=k` exclui `seq <= k` e traz `seq === k + 1` (fronteira `>` vs `>=`), `desde=-1` ou `desde=abc` recebe `422 CURSOR_INVALIDO`;
  - `PESSOA_DESLIGADA` e `PESSOA_SUSPENSA` (na confirmação periódica vencida ou desligamento) trazem `sujeitos` com o `sub` e o `login` da pessoa (inclusive para ator da base que tem `sub` UUID e `login`), e nunca trazem o CPF;
  - em modo JWT (`jwt-verificacao.test.mjs`), `GET /v2/eventos` aceita `Bearer svc.shell` (`200`), recusa `svc.idp`, `svc.zona1` e `svc.acesso` (`404`) e recusa JWT de usuário (`404`).
- [ ] **Passo 2: implementar** em `repos/erp-dominio-stub/src/gestao-acesso-v2/servidor.mjs` e atualizar `contratos/gestao-acesso-v2.openapi.yaml`.
- [ ] **Passo 3: rodar testes** (`cd repos/erp-dominio-stub && pnpm test`) e ver passar.
- [ ] **Passo 4: mutações declaradas** (aplicar no `src`, rodar `pnpm test`, registrar o teste que pegou e reverter):

| # | Mutação | Teste que precisa reprovar |
|---|---|---|
| M1 | `GET /v2/eventos` aceitar qualquer `svc.*` ou pessoa autenticada | só `svc.shell` lê `/v2/eventos`; outros recebem 404 |
| M2 | tirar `ROTA_DE_SERVICO` de `GET /v2/eventos` | modo JWT aceita `svc.shell` em `/v2/eventos` |
| M3 | filtro `ev.seq >= desde` em vez de `ev.seq > desde` (fronteira) | `desde=k` não repete o evento `k` |
| M4 | aceitar `desde < 0` ou `NaN` como `0` | `desde` negativo ou texto dá `422 CURSOR_INVALIDO` |
| M5 | omitir `sujeitos` ou omitir `p.sub` / `p.login` no evento de pessoa | evento `PESSOA_DESLIGADA` e `PESSOA_SUSPENSA` traz `sujeitos` completos |
| M6 | vazar `p.cpf` no evento | nenhum evento contém o CPF da pessoa |

- [ ] **Passo 5: commit no submódulo** `erp-dominio-stub`: `feat(stub): restrict /v2/eventos to svc.shell and include subject ids (G5)`.

### Task 2: remoção de sessão por sujeito no núcleo 0.10.5 (erp-nucleo)

**Arquivos:** `repos/erp-nucleo/src/portas/sessao.ts`, `repos/erp-nucleo/src/adaptadores/sessao-redis.ts`, `repos/erp-nucleo/src/adaptadores/sessao-arquivo.ts`, `repos/erp-nucleo/src/testing/index.ts`, `repos/erp-nucleo/src/fabricas/criarNucleo.ts`, `repos/erp-nucleo/scripts/fronteira.mjs`, `repos/erp-nucleo/test/sessao-redis.test.mjs`, `repos/erp-nucleo/test/nucleo.test.mjs`, `repos/erp-nucleo/package.json`.

**Interfaces produzidas:**
- Em `EscritorDeSessao` (`portas/sessao.ts`): `removerPorSujeito(sub: string): Promise<number>`, que apaga todas as sessões armazenadas cujo `sub === sub` e devolve a quantidade de sessões efetivamente removidas.
- Em `NucleoDoShell['sessao']` (`fabricas/criarNucleo.ts`): `removerSessoesDoSujeito(sub: string): Promise<number>`, delegando ao `escrita.store.removerPorSujeito(sub)`.
- Em `scripts/fronteira.mjs`: `'removerPorSujeito'` e `'removerSessoesDoSujeito'` adicionados a `CAPACIDADES_DE_ESCRITA` para que a verificação de fronteira por tipo garanta que nenhum módulo fora de `/shell` e `/testing` exporte essa capacidade (invariante 15).
- Em `sessaoRedisDeEscrita` (`adaptadores/sessao-redis.ts`):
  - Novo prefixo configurável `prefixoSujeito?: string` (padrão `'erp:sujeito:'`), validado com `validarPrefixos` para nunca colidir com `prefixo` (`'erp:sessao:'`), `prefixoLogin` ou `prefixoLock` (assim a ACL das zonas `~erp:sessao:*` nunca alcança o índice por sujeito).
  - Ao `gravar(id, s)` (quando `ttl > 0` e `s.sub` válido): além de gravar a chave da sessão `chave(prefixo, id)`, registra a chave da sessão no índice do sujeito `chave(prefixoSujeito, s.sub)` (JSON com lista de chaves de sessão daquele `sub`, com `PX` igual ao maior TTL entre o atual da lista e o da nova sessão).
  - Ao `removerPorSujeito(sub)`: se `typeof sub !== 'string' || !sub.length`, retorna `0` sem ir ao Redis; caso contrário, consome (`getDel`) a chave `chave(prefixoSujeito, sub)`, apaga (`del`) cada chave de sessão listada e retorna a soma das chaves que existiam (`del === 1`). Erros do cliente Redis são normalizados em `ErroDeAplicacao('ERRO_INTERNO', ...)` como nas demais operações.
- Em `sessaoArquivoDeEscrita` (`adaptadores/sessao-arquivo.ts`) e `sessaoMemoria` (`testing/index.ts`): `removerPorSujeito(sub)` varre as sessões do store, remove todas com `s.sub === sub` (ignorando e limpando expiradas) e devolve quantas sessões válidas foram removidas (`0` para `sub` vazio ou inexistente).

- [ ] **Passo 1: testes que reprovam** em `test/sessao-redis.test.mjs` e `test/nucleo.test.mjs`:
  - nos três stores (`sessaoMemoria`, `sessaoArquivoDeEscrita`, `sessaoRedisDeEscrita`), gravar 2 sessões de `'ana'` e 1 de `'bruno'`; `removerPorSujeito('ana')` devolve `2`, apaga as duas de `'ana'` (`ler` devolve `null`) e mantém a de `'bruno'` intacta;
  - chamar `removerPorSujeito('ana')` de novo devolve `0`; `sub` vazio `''` ou não-string devolve `0` sem tocar o Redis;
  - sessão já expirada ou já removida por `remover(id)` antes de `removerPorSujeito` não é contada como removida (`0`);
  - no Redis, a chave de índice usa `erp:sujeito:<sha256>` (nunca o `sub` cru e nunca dentro de `erp:sessao:*`), e `prefixoSujeito` colidindo com `prefixo`, `prefixoLogin` ou `prefixoLock` é recusado na criação;
  - no Redis fora do ar, `removerPorSujeito` rejeita com `ErroDeAplicacao` (`ERRO_INTERNO`) sem vazar mensagem nem stack do cliente;
  - em `criarNucleoDoShell`, `shell.sessao.removerSessoesDoSujeito('ana')` remove todas as sessões de `'ana'` e `zona.sessao.atual()` passa a devolver `null`; o núcleo de zona (`criarNucleo`) não tem `removerSessoesDoSujeito`.
- [ ] **Passo 2: implementar** nos arquivos do `erp-nucleo` e atualizar `package.json` para `0.10.5`.
- [ ] **Passo 3: rodar testes e fronteira** (`cd repos/erp-nucleo && pnpm test`) e ver passar.
- [ ] **Passo 4: mutações declaradas** (aplicar no `src`, rodar `pnpm test`, registrar e reverter):

| # | Mutação | Teste que precisa reprovar |
|---|---|---|
| M1 | `removerPorSujeito` apagar todas as sessões sem comparar `s.sub === sub` | sessão de outro sujeito (`bruno`) permanece intacta |
| M2 | `gravar` sobrescrever a lista do sujeito com `[chaveSessao]` em vez de acumular | segunda sessão do mesmo sujeito também é removida (devolve `2`, ambas `null`) |
| M3 | TTL do índice do sujeito usar `Math.min` (ou só o novo `ttl` menor) em vez de `Math.max` | sessão mais longa não perde o índice quando uma mais curta do mesmo sujeito é gravada |
| M4 | chave do índice do sujeito usar `sub` cru sem SHA-256 ou cair em `erp:sessao:*` | chave usa `erp:sujeito:<sha256>` fora de `erp:sessao:*` |
| M5 | não validar colisão de `prefixoSujeito` com os demais prefixos | colisão de `prefixoSujeito` lança na criação |
| M6 | `removerPorSujeito` engolir erro do Redis e devolver `0` | Redis fora do ar lança `ErroDeAplicacao('ERRO_INTERNO')` |
| M7 | `removerPorSujeito('')` chamar o Redis | `sub` vazio devolve `0` com `0` chamadas ao Redis |

- [ ] **Passo 5: commit no submódulo** `erp-nucleo`: `feat(nucleo): add session removal by subject in shell stores (G5, 0.10.5)`.

### Task 3: lockstep `@erp/nucleo` 0.10.5 e consumidor `revogacao-ativa.ts` no shell (erp-shell e zonas)

**Arquivos:**
- `repos/erp-{shell,zona-1,zona-2,zona-acesso}/package.json` e `pnpm-lock.yaml` (se aplicável ao publicar `0.10.5` no registro local);
- criar `repos/erp-shell/lib/revogacao-ativa.ts` e `repos/erp-shell/test/revogacao-ativa.test.mjs`;
- modificar `repos/erp-shell/lib/configuracao.ts` e `repos/erp-shell/lib/nucleo.ts`.

**Interfaces produzidas:**

```ts
export type EventoDeAcesso = {
  seq: number
  tipo: string
  alvo?: string
  sujeitos?: readonly string[]
}
export type FonteDeEventos = (desde: number) => Promise<readonly EventoDeAcesso[]>
export type CoordenadorDeEventos = {
  adquirirLock(ttlMs: number): Promise<boolean>
  lerCursor(): Promise<number>
  gravarCursor(seq: number): Promise<void>
}
export type RevogadorDeSessoes = {
  /** Dispara a sincronização se o intervalo venceu; nunca lança para quem chama (falha vai para registrarFalha). */
  sincronizarSePreciso(): Promise<void>
  /** Força uma rodada imediata (usado pelos testes de unidade). */
  sincronizarAgora(): Promise<void>
}
export function criarRevogacaoAtiva(cfg: {
  fonte: FonteDeEventos
  coordenador: CoordenadorDeEventos
  removerPorSujeito: (sub: string) => Promise<number>
  intervaloMs: number
  lockMs: number
  agora?: () => number
  registrarFalha?: (motivo: string) => void
}): RevogadorDeSessoes
```

**Regras:**
- Tipos de evento que encerram sessão: `EVENTOS_QUE_ENCERRAM_SESSAO = new Set(['PESSOA_DESLIGADA', 'PESSOA_SUSPENSA'])`. Qualquer outro evento (como `ACESSO_REVOGADO`, `ACESSO_CONCEDIDO`, `ROTA_DE_ZONA_REGISTRADA`) avança o cursor sem remover sessão.
- Intervalo: `lerIntervaloDeEventos(env)` lê `ERP_EVENTOS_ACESSO_INTERVALO_MS` (padrão `5000`, mínimo `100`, teto `60000`, inteiro). Lock: `lerLockDeEventos(env)` lê `ERP_EVENTOS_ACESSO_LOCK_MS` (padrão `10000`, mínimo `1000`, teto `120000`, inteiro, e deve ser `> intervaloMs` ou validado em `verificarConfiguracaoDoShell`).
- Consumidor único: antes de buscar na fonte, chama `coordenador.adquirirLock(lockMs)` (no Redis: `SET erp:eventos-acesso:lock '1' NX PX <lockMs>`; sem Redis, em modo arquivo/dev de processo único, um coordenador em memória do processo). Se perder o lock (`false`), encerra a rodada sem chamar a fonte.
- Cursor gravado só pelo shell: lê `desde = await coordenador.lerCursor()` (`0` se ausente ou inválido). Chama `fonte(desde)`. Ordena os eventos válidos (`Number.isInteger(ev.seq) && ev.seq > desde`) por `seq` crescente.
- Para cada evento em ordem de `seq`:
  - se `EVENTOS_QUE_ENCERRAM_SESSAO.has(ev.tipo)`, extrai os `sujeitos` válidos (`Array.isArray(ev.sujeitos)` com strings não vazias; fallback para `ev.alvo` se for string não vazia) e chama `removerPorSujeito(s)` para cada um;
  - se qualquer `removerPorSujeito` lançar, interrompe o processamento da lista, grava o cursor do último evento inteiramente processado antes da falha (para que o evento que falhou seja reprocessado na próxima rodada) e registra a falha em `registrarFalha`.
- Ao terminar a lista sem erro e tendo eventos novos (`maiorSeq > desde`), grava `coordenador.gravarCursor(maiorSeq)`.
- Concorrência no próprio processo: chamadas simultâneas a `sincronizarSePreciso()` compartilham a mesma promessa em andamento (`emCurso`), fazendo uma busca só.

- [ ] **Passo 1: atualizar `@erp/nucleo` para `0.10.5`** nas 4 apps e conferir `task lockstep`.
- [ ] **Passo 2: testes de unidade que reprovam** em `repos/erp-shell/test/revogacao-ativa.test.mjs`:
  - `PESSOA_DESLIGADA` e `PESSOA_SUSPENSA` removem as sessões de todos os `sujeitos` do evento e gravam o maior `seq` no cursor;
  - `ACESSO_REVOGADO` e outros tipos avançam o cursor sem chamar `removerPorSujeito`;
  - cursor avança monotonicamente: segunda rodada busca `desde = ultimoSeq` e ignora evento repetido com `seq <= desde`;
  - consumidor único: quando `adquirirLock` devolve `false`, não lê cursor, não chama a fonte e não remove sessão;
  - falha parcial em `removerPorSujeito` no segundo evento grava o cursor do primeiro evento e reprocessa o segundo na rodada seguinte;
  - falha na fonte ou no coordenador não propaga exceção para quem chama `sincronizarSePreciso()`, registra em `registrarFalha` e tenta de novo no próximo intervalo;
  - intervalo respeitado: antes de `intervaloMs` (`agora === intervaloMs - 1`) não sincroniza; em `agora === intervaloMs` sincroniza; chamadas simultâneas compartilham a mesma execução;
  - validação de `ERP_EVENTOS_ACESSO_INTERVALO_MS` e `ERP_EVENTOS_ACESSO_LOCK_MS` nos limites exatos (`100` e `60000` aceitos; `99` e `60001` recusados; `1000` e `120000` aceitos; `999` e `120001` recusados).
- [ ] **Passo 3: implementar** `lib/revogacao-ativa.ts`, `lib/configuracao.ts` e o destino `eventos-acesso` em `lib/nucleo.ts`.
- [ ] **Passo 4: rodar testes** (`cd repos/erp-shell && pnpm test`) e ver passar.
- [ ] **Passo 5: mutações declaradas** (aplicar, rodar `pnpm test`, registrar e reverter):

| # | Mutação | Teste que precisa reprovar |
|---|---|---|
| M1 | remover sessão também em `ACESSO_REVOGADO` | `ACESSO_REVOGADO` não chama `removerPorSujeito` |
| M2 | não remover em `PESSOA_SUSPENSA` (só em `PESSOA_DESLIGADA`) | `PESSOA_SUSPENSA` remove as sessões do sujeito |
| M3 | ignorar `adquirirLock === false` e buscar eventos mesmo assim | perdedor do lock não chama a fonte |
| M4 | gravar o cursor final mesmo quando `removerPorSujeito` lança no meio | falha parcial mantém o cursor no último evento concluído |
| M5 | usar `>` em vez de `>=` na comparação do intervalo (`agora - ultima >= intervaloMs`) | exatamente em `intervaloMs` sincroniza |
| M6 | aceitar `ev.seq >= desde` ao filtrar eventos devolvidos | evento repetido com `seq === desde` é ignorado |
| M7 | limites de `lerIntervaloDeEventos` (`< 100` virar `<= 100` ou `> 60000` virar `>= 60000`) | fronteiras `100`, `60000`, `1000` e `120000` |

- [ ] **Passo 6: commits nos submódulos** (`erp-shell`, `erp-zona-1`, `erp-zona-2`, `erp-zona-acesso`).

### Task 4: ligação no `proxy.ts`, ponta a ponta e documentos (erp-shell e principal)

**Arquivos:** `repos/erp-shell/proxy.ts`, `repos/erp-shell/lib/decisao-proxy.ts`, `repos/erp-shell/test/proxy.test.mjs`, `base/verificacao/base.test.mjs`, `docs/CONFIGURACAO.md`, `docs/adr/0014-gestao-de-acesso-v2.md`, `.agents/orchestrator/RETOMADA.md`, `.agents/orchestrator/ATIVIDADES.md`.

**Regras:**
- Em `decidirAcaoDoProxy` (`repos/erp-shell/lib/decisao-proxy.ts`) e `proxy.ts`: quando a requisição traz cookie de sessão (`temCookieSessao && idSessao`) e não é rota pública, telemetria nem estático de zona, chama `await sincronizarEventos()` antes de `renovarSessao(idSessao)`. Se o sujeito daquela sessão tiver sido desligado ou suspenso, `sincronizarEventos()` apaga a sessão no store e, logo em seguida, `renovarSessao(idSessao)` vê a sessão ausente (`'ausente'`) e o proxy redireciona para `/login` limpando o cookie `__Host-session`!
- Atualizar `base/verificacao/base.test.mjs:1572`: em modo JWT (`IDP_EMISSOR`), `svc.shell` agora recebe `200` em `GET /v2/eventos` (rota de serviço do shell), enquanto `svc.zona1` e `svc.idp` recebem `404`.
- Novo teste ponta a ponta em `base/verificacao/base.test.mjs` (ou teste integrado com o shell e a gestão de acesso v2): pessoa autenticada tem sessão ativa; após `POST /v2/pessoas/{id}/desligamento`, o consumidor de eventos do shell encerra a sessão no store e a requisição seguinte ao shell (mesmo a uma rota que não chama `/v2/eu`, ou antes de o access token vencer) redireciona `307` para `/login` com `Max-Age=0` no cookie; enquanto revogação de módulo (`POST /v2/acessos/{id}/revogacao`) mantém a sessão ativa em `GET /`.
- Documentar `ERP_EVENTOS_ACESSO_INTERVALO_MS` e `ERP_EVENTOS_ACESSO_LOCK_MS` em `docs/CONFIGURACAO.md`, atualizar o adendo 2 do `docs/adr/0014-gestao-de-acesso-v2.md` como implementado e atualizar `RETOMADA.md` e `ATIVIDADES.md`.

- [ ] **Passo 1: ligar no `decisao-proxy.ts` e `proxy.ts`** com teste em `repos/erp-shell/test/proxy.test.mjs` provando que `sincronizarEventos` roda antes de `renovarSessao` e que uma sessão cujo sujeito foi desligado em `/v2/eventos` recebe `redirecionar-login` com `limparSessao: true` na requisição seguinte.
- [ ] **Passo 2: atualizar `base.test.mjs` e `docs/CONFIGURACAO.md`**, `docs/adr/0014-gestao-de-acesso-v2.md`, `RETOMADA.md` e `ATIVIDADES.md`.
- [ ] **Passo 3: mutações declaradas da ligação**:

| # | Mutação | Teste que precisa reprovar |
|---|---|---|
| M1 | chamar `sincronizarEventos` depois de `renovarSessao` em `decidirAcaoDoProxy` | sessão com token válido cujo sujeito foi desligado no evento cai em `/login` na própria requisição |
| M2 | não chamar `sincronizarEventos` em páginas do próprio shell (`/`) | navegação a `/` após desligamento redireciona para `/login` |

- [ ] **Passo 4: rodar verificações completas** (`task test`, `task typecheck`, `task verificar:estatica`, `task scripts:test`, `task lockstep`), registrar e commitar submódulos e principal.
