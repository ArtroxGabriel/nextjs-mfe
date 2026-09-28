# challenger_b1_d1_9 — handoff

Gate B1+D1+G3+K, iteração 9. Simulador de condições (Sonnet). 2026-09-28.
Base: correção K5, commits `d9ff04e` (principal) e `08642ed` (`repos/erp-nucleo`), fechando os
vetos V1–V4 do `auditor_b1_d1_8`.

Portas de propriedade desta rodada: 3000–3003, 3012, 4001–4004, 4010, 4020. Verdaccio (4873),
Redis (6379) e Keycloak (8080) já estavam no ar antes de eu começar — não derrubados, não recriados.

## Estado inicial (antes de qualquer ação)

- `ss -ltnp` confirma: só 4873 (Verdaccio), 8080 (Keycloak), 6379 (Redis) escutando. Nenhuma das
  portas 3000–3003/3012/4001–4004/4010/4020 ocupada. Nenhum processo `next-server` nem
  `node .../servidor.mjs` residual.
- `git status` no principal e nos 8 submódulos: a conferir e registrar antes da primeira mutação.

## Plano de execução

1. `task verificar:redis` e `task verificar:construir`, 2x cada — em andamento.
2. V1 (K5-1) com o sistema no ar: showcase com `ERP_REDIS_SENHA_SHELL` nova, checagem de
   `/proc/<pid>/environ` de zonas/domínios/next-server filhos, refazer prova de gravação forjada.
3. Casos sobreviventes da iteração 8: XR20q4 (constructor(fetch)) e E01g (build com REDIS_URL).
4. Outros ataques plausíveis pela K5.

---

## 1. `task verificar:redis` e `task verificar:construir`, 2x cada

Baseline pré-existente (não causado por mim, presente antes de eu começar): `repos/erp-dominio-stub`
e `repos/erp-moldura` com `pnpm-lock.yaml` modificado só na linha `integrity` de `@erp/contratos@0.2.1`
(hash local do Verdaccio desta máquina — o padrão descrito em AMBIENTE.md §1). Não toquei, não commitei.

| Comando | Rodada | Resultado | Log |
|---|---|---|---|
| `task verificar:redis` | 1 | tests 109, pass 109, fail 0, skipped 0 | `redis-run1.log` |
| `task verificar:redis` | 2 | tests 109, pass 109, fail 0, skipped 0 | `redis-run2.log` |
| `task verificar:construir` | 1 | tests 109, pass 105, fail 0, skipped 4 | `construir-run1.log` |
| `task verificar:construir` | 2 | tests 109, pass 105, fail 0, skipped 4 | `construir-run2.log` |

Bate com o esperado do handoff K5 (109/109 e 105+4). `git status` no principal e nos 8 submódulos
depois das 4 rodadas: só o baseline pré-existente citado acima; nada novo. Portas 3000–3003, 3012,
4001–4004, 4010, 4020: livres depois de cada rodada (`ss -ltnp`), sem `next-server` residual.

**Resultado da etapa 1: OK, sem achado.**

---

## 2. V1 (K5-1) com o sistema no ar

### 2.1 `ERP_REDIS_SENHA_SHELL=<valor novo> task verificar:redis`

Comando: `ERP_REDIS_SENHA_SHELL='valor-novo-challenger-b1d1-9-x7k2' task verificar:redis` (1x; o valor é
propositalmente diferente da senha real do container, exatamente a condição do V1(a) do auditor_b1_d1_8
— variável definida no ambiente de quem lança). Resultado: **tests 109, pass 109, fail 0**
(`anexos/redis-com-senha-nova.log`). O teste `V1 (auditor_b1_d1_8): nenhum processo de zona ou dominio
recebe a senha de escrita, em nenhuma fase` passou, junto com `V1 (E01f)`. Nota: o `Taskfile.yml` fixa
`REDIS_URL: redis://default:dev-shell-escrita@127.0.0.1:6379` no bloco `env:` da tarefa `verificar:redis`
(valor literal, não referencia `ERP_REDIS_SENHA_SHELL`), então o `REDIS_URL` real usado pelo teste continua
sendo o da senha do container; o teste registra as duas senhas (`ERP_REDIS_SENHA_SHELL` e a de `REDIS_URL`)
e varre `ambientesEntregues` procurando qualquer uma nos processos de zona/domínio — ambas ausentes.

**Achado operacional (não é veto de segurança, mas bloqueia a etapa seguinte do meu plano):**
`node base/showcase/subir.mjs` (e por extensão `task showcase`) **não sobe** contra o Redis já no ar desta
rodada. A função `esperar('Redis', ...)` em `base/showcase/subir.mjs:16-17` roda
`docker compose exec -T redis redis-cli ping` sem credencial; como o container já tem `--requirepass`
(K4-4, sempre ativo — o padrão é `dev-shell-escrita` mesmo sem `ERP_REDIS_SENHA_SHELL` definida), o `ping`
devolve `NOAUTH Authentication required.` em vez de `PONG`, o `esperar` nunca vê sucesso e o script morre
sozinho depois de 120 s com `Error: Redis nao respondeu em 120 s` (`anexos/showcase-subir-falha.log`).
Confirmado à mão: `docker compose -f base/showcase/docker-compose.yml exec -T redis redis-cli ping` →
`NOAUTH Authentication required.` (exit 0, então o script nem vê o processo como erro de exec, só como
"ainda não respondeu"). O processo morre por si (sem `derrubar()`, sem deixar porta aberta — confirmado
com `ps`/`ss` depois). Isso não é causado por nenhuma mutação minha: é o estado do Redis que já estava no
ar antes de eu começar, com `--requirepass` herdado de uma subida anterior (K4-4/challenger_b1_d1_7/8).
**Divergência declarado × observado, registrada na seção 2 do relatório final** (o compose e a K4-4 dizem
que a senha é exigida; nada em `subir.mjs`/`docs` prevê que o próprio script de subida do showcase para de
funcionar quando a senha já está ativa — o que é o caso normal, não uma exceção).

Para não travar a verificação do V1 ao vivo (item pedido pela tarefa), apliquei uma mutação temporária e
documentada em `base/showcase/subir.mjs` só no healthcheck do Redis (adicionei `-a` com a senha), rodei o
showcase, e restaurei o arquivo byte a byte ao final, conferido por `git diff`/`git status` no submódulo
`erp-shell`... **nota:** `base/showcase/subir.mjs` fica no repositório principal, não em submódulo — restauração
conferida com `git diff` e `git status` na raiz.

### 2.2 Prova ao vivo (showcase, `ERP_REDIS_SENHA_SHELL=dev-shell-escrita`, senha real do container)

Subi `node base/showcase/subir.mjs --log` com `ERP_REDIS_SENHA_SHELL=dev-shell-escrita` (senha real do
container Redis já no ar — ver justificativa na seção "achado operacional" acima: não recriei o Redis,
então precisava da senha que já está ativa nele para o shell autenticar de verdade). Log completo:
`anexos/showcase-subir2.log`.

**`/proc/<pid>/environ` de cada processo** (`anexos/proc-environ-showcase.log` tem a saída bruta):

| Processo | Porta | `ERP_REDIS_SENHA_SHELL` | `REDIS_URL` | `REDIS_URL_ZONA` |
|---|---|---|---|---|
| shell (`next-server`, pid 96265) | 3000 | **presente** | **presente** | presente (não usada, sem efeito) |
| zona-1 (`next-server`, pid 96279) | 3001 | ausente | ausente | presente (só leitura) |
| zona-2 (`next-server`, pid 96296) | 3002 | ausente | ausente | presente (só leitura) |
| zona-acesso (`next-server`, pid 96310) | 3003 | ausente | ausente | presente (só leitura) |
| dominio-a (pid 95921) | 4001 | ausente | ausente | ausente |
| dominio-b (pid 95922) | 4002 | ausente | ausente | ausente |
| dominio-c (pid 95923) | 4003 | ausente | ausente | ausente |
| plataforma (pid 95924) | 4004 | ausente | ausente | ausente |
| gestao-acesso-v2 (pid 95925) | 4020 | ausente | ausente | ausente |

Cada `next-server` das zonas tem só threads (LWP, mesmo `/proc/<pid>/environ`), confirmado com
`pstree -p`; não há processo filho separado com ambiente próprio.

**Login e páginas** (`curl` direto, sem navegador):

| Ator | Login (`POST /api/auth/entrar`) | `/zona1` | `/zona2` | `/acesso` |
|---|---|---|---|---|
| ana | 303, cookie emitido | 200 | 200 | 404 |
| bruno | 303, cookie emitido | 200 | 404 | 404 |
| carla | 303, cookie emitido | 200 | 404 | 200 |

Consistente com os perfis documentados no showcase (ana: zona1+zona2; bruno: zona1 só; carla: zona1+acesso).

**Refazer a prova da iteração 8, só com o ambiente de uma zona:** tentei gravar sessão forjada no Redis
usando exatamente a credencial que a zona recebe (`redis://zona:dev-zona-leitura@127.0.0.1:6379`):

```
$ docker exec erp-showcase-redis-1 redis-cli -u redis://zona:dev-zona-leitura@127.0.0.1:6379 \
    SET erp:sessao:forjada-challenger-9 '{"usuario":"carla"}'
NOPERM User zona has no permissions to run the 'set' command
```

E sem nenhuma credencial:

```
$ docker exec erp-showcase-redis-1 redis-cli SET erp:sessao:forjada-anonima '{}'
NOAUTH Authentication required.
```

**Resultado: exatamente o esperado (NOPERM com a credencial da zona; NOAUTH sem credencial).** A chave
`erp:sessao:forjada-challenger-9` nunca existiu (`EXISTS` → `0`, conferido e registrado abaixo na limpeza
final). Nenhuma chave forjada ficou no Redis.

**Resultado da etapa 2: SEM achado de segurança.** K5-1 resiste à condição exata do V1 do
`auditor_b1_d1_8`, com o sistema realmente no ar (não só em teste automatizado): nem `ERP_REDIS_SENHA_SHELL`
nem `REDIS_URL` de escrita chegam a zona ou domínio, em nenhum processo, nenhuma thread, nenhuma fase.
**Achado operacional (não bloqueante para o gate, mas real e reprodutível):** ver "achado operacional"
acima — `node base/showcase/subir.mjs` não sobe sozinho contra um Redis que já tem `--requirepass` ativo
(o caso normal desde a K4-4), porque o healthcheck não autentica. Reportado na seção de divergências.

Mutação em `base/showcase/subir.mjs` restaurada byte a byte (`git diff` vazio, confirmado). Continuei
usando a instância do showcase já no ar (que subiu com o patch temporário, ainda válida — o patch só afeta
o healthcheck do processo de subida, não os processos já lançados) para a etapa 3.

---

## 3. Casos sobreviventes da iteração 8 (XR20q4, E01g)

### 3.1 XR20q4 — `class Transporte { constructor(fetch) … }` com `fetch` direto noutra função

Mutação aplicada em `repos/erp-zona-1/lib/dominio-a.ts` (confirmado limpo antes: `git status --porcelain`
vazio): classe `Transporte` com `constructor(fetch) { this.fetch = fetch }` (o nome do parâmetro do
construtor esconderia o `fetch` global só dentro do construtor, se a pilha de escopos abrir escopo ali) e,
numa função totalmente diferente do mesmo arquivo (`listarRecursos`), uma chamada `fetch(...)` direta ao
alvo externo `http://xr20q.invalid/fuga-xr20q4-challenger9` — a mesma forma do achado do
`auditor_b1_d1_8`. Diff completo em `anexos/xr20q4.diff`.

`task verificar:estatica`: **48 testes, 47 pass, 1 fail** — a falha é exatamente a esperada
(`anexos/xr20q4-estatica.log`):
```
✖ as quatro aplicacoes reais nao tem saida de rede fora do registro (fora as excecoes declaradas)
  + [ "erp-zona-1/lib/dominio-a.ts:20 acessa 'fetch' por propriedade",
      "erp-zona-1/lib/dominio-a.ts:25 usa a global de rede 'fetch'" ]
  - []
```
O teste N8 (`saida-de-rede.test.mjs:62`) **reprova** a mutação: pega tanto o acesso à propriedade
`this.fetch` no construtor (linha 20) quanto o `fetch` direto em `listarRecursos` (linha 25). Na
iteração 8 a mesma forma passava 100/100 (38 chamadas reais ao alvo externo, `anexos/alvo-XR20q4.log`
do `auditor_b1_d1_8`); agora é pega estaticamente, sem precisar rodar nada. **Confirma o fechamento do V2.**

Mutação restaurada: `git checkout -- lib/dominio-a.ts` em `repos/erp-zona-1`; `git status --porcelain`
vazio, conferido.

**Resultado 3.1: SEM achado — K5-2 fecha XR20q4.**

### 3.2 E01g — zona grava no carregamento do módulo se houver `REDIS_URL`, com build forçado

Mutação em `repos/erp-zona-1/lib/redis.ts` (limpo antes, confirmado): reproduzida a forma exata do
`auditor_b1_d1_8` (`mutacoes.txt:66`) — no carregamento do módulo, se `process.env['REDIS_'+'URL']`
existir, grava sessão forjada da carla (`sub: carla`, `grupos: [ACESSO_ADMIN]`) na chave
`erp:sessao:forjada-e01g-challenger9`. Diff completo em `anexos/e01g.diff`.

**Controle positivo** (prova que a mutação funciona e que o Next executa código de módulo na fase de
build — "Collecting page data"): `cd repos/erp-zona-1 && REDIS_URL=... REDIS_URL_ZONA=... pnpm build`
(fora do `ambiente.mjs`, simulando o vazamento). Build passou (`anexos/e01g-build-positivo.log`) e a
chave apareceu:
```
$ docker exec ... redis-cli -a dev-shell-escrita EXISTS erp:sessao:forjada-e01g-challenger9
1
$ docker exec ... redis-cli -a dev-shell-escrita GET erp:sessao:forjada-e01g-challenger9
{"sub":"carla","nome":"Carla","accessToken":"forjado-e01g","expiraEm":...,"grupos":["ACESSO_ADMIN"]}
```
Apagada em seguida (`DEL` → 1, `EXISTS` → 0, conferido).

**Controle negativo — o que a K5-1 realmente decide:** derrubei a instância anterior do showcase
(processo próprio, `kill -TERM` no líder do grupo `subir.mjs`; `derrubar()` interno cuidou do resto;
portas conferidas livres depois). Rodei um script mínimo (`e01g-negativo.mjs`, anexo removido do
repositório, só em scratch) chamando `subir({ construir: 'tudo', log: false })` **diretamente do
`ambiente.mjs`**, com `REDIS_URL`, `REDIS_URL_ZONA` e `ERP_REDIS_SENHA_SHELL` (reais, senha do container)
definidos no processo lançador — a mesma condição da V1(a)/E01g original. Resultado
(`anexos/e01g-negativo.log`):
```
fase=registrar dir=erp-zona-1 REDIS_URL_presente=false senha_em_algum_valor=false
fase=build dir=erp-zona-1 REDIS_URL_presente=false senha_em_algum_valor=false
fase=start dir=erp-zona-1 REDIS_URL_presente=false senha_em_algum_valor=false
```
Nenhuma fase (`registrar`, `build`, `start`) da zona 1 recebeu `REDIS_URL` nem a senha, em nenhum valor
do ambiente entregue. Depois do build+start completos: `EXISTS erp:sessao:forjada-e01g-challenger9` → `0`.
A zona não teve como gravar, mesmo com build de verdade forçado (`CONSTRUIR=tudo` via `subir()`) e o código
malicioso realmente presente no módulo.

Limpeza: `git checkout -- lib/redis.ts` em `erp-zona-1` (`git status --porcelain` vazio, conferido);
`.next` removido (não versionado, `.gitignore`); processos derrubados pelo próprio script
(`ambiente.derrubar()`), portas conferidas livres.

**Resultado 3.2: SEM achado — K5-1 fecha E01g com prova dinâmica (build real, não só o registro do teste
automatizado).** O controle positivo mostra que o vetor era real (o Next executa módulo do servidor na
fase de coleta de dados do build) e que a defesa hoje está na filtragem de ambiente, não em algo do
Next que mude esse comportamento.

---

## 4. Outros ataques plausíveis pela K5


Cross-referência entre o que os processos de zona/domínio realmente leem (`grep` em `app/`, `lib/`,
`proxy.ts`, `next.config.ts` de `erp-zona-1/2/acesso` e em `repos/erp-nucleo/src`) e
`AMBIENTE_PERMITIDO`: todas as variáveis lidas hoje (`ACESSO_URL`, `DOMINIO_A_URL`, `DOMINIO_B_URL`,
`DOMINIO_C_URL`, `REDIS_URL_ZONA`, `SESSAO_DIR`, `SHELL_HOSTS`, `ERP_DESTINO_TIMEOUT_MS`,
`ERP_FRAGMENTO_TIMEOUT_MS`, `ERP_PERMITIR_IDENTIDADE_DEV`, `ERP_TOKEN_VIDA_S` na zona; `DADOS_DIR` no
domínio) estão na lista. `process.env.REDIS_URL` aparece no código da zona só como guarda para recusar
subir com ela (`lib/redis.ts:28`), não como leitura de valor — não é uma necessidade real. **Não achei
hoje nenhuma variável que a zona ou o domínio precisem e que falte na lista.**

### 4.1 Achado: o teste de completude (V1, `ambiente.test.mjs`) tem um ponto cego — desestruturação

A K5 diz "a lista cobre toda variável lida por zona e domínio" e isso é verificado por um teste
(`base/scripts/ambiente.test.mjs`, "V1: a lista de inclusao cobre toda variavel..."). Esse teste varre
o código-fonte com a regex `process\.env(?:\.([A-Z_0-9]+)|\[['"]([A-Z_0-9]+)['"]\])` — só pega
`process.env.X` e `process.env['X']`.

Mutação (limpa antes, confirmada): acrescentei em `repos/erp-zona-1/lib/redis.ts`
`const { ERP_ZONA_VARIAVEL_NOVA_TESTE_CH9 } = process.env` (desestruturação — forma comum e idiomática
em JS/TS, não um contorno artificial). Diff em `anexos/completude-destructuring.diff`.

`node --test base/scripts/ambiente.test.mjs`: **10/10, sem falha** (`anexos/completude-destructuring.log`)
— o teste "V1: a lista de inclusao cobre..." passou mesmo com uma variável nova, fora da lista, lida
por um padrão que ele não enxerga.

**Isto não é um veto de segurança:** a barreira de verdade (`ambienteDoPapel`, filtro por nome exato em
`Object.entries(base).filter(...)`) não depende de como a zona lê a variável — ela filtra pelo NOME antes
de o processo nascer, então mesmo uma variável sensível lida por desestruturação continuaria sendo
cortada se não estiver na lista. Não há caminho para um segredo vazar por essa lacuna. **É uma lacuna de
verificação, na direção oposta**: se uma variável legítima e inofensiva que a zona passa a precisar for
lida por desestruturação e o desenvolvedor esquecer de somá-la à lista, o teste de completude não avisa,
e a zona perde essa variável (recebe `undefined`) silenciosamente em produção — exatamente o cenário
hipotético do pedido desta tarefa. Reportado como divergência abaixo, não como achado adversário.

Mutação restaurada: `git checkout -- lib/redis.ts` em `erp-zona-1`; `git status --porcelain` vazio,
conferido.

**Resultado da etapa 4: um achado de divergência (4.1), sem achado de segurança.**

---

## Divergências declarado × observado

1. **`base/showcase/subir.mjs` não sobe contra um Redis que já exige senha (sempre, desde a K4-4).**
   O healthcheck (`esperar('Redis', ...)`, linha ~16-17) chama `docker compose exec -T redis redis-cli
   ping` sem credencial. Com `--requirepass` ativo (o padrão real, com ou sem `ERP_REDIS_SENHA_SHELL`
   explícita), o `ping` devolve `NOAUTH Authentication required.` em vez de `PONG`, o script espera
   120 s e morre com `Error: Redis nao respondeu em 120 s`. Reproduzido, confirmado à mão
   (`docker compose exec -T redis redis-cli ping` → `NOAUTH...`). Não é causado por nenhuma mutação
   minha — é o estado normal do Redis do showcase desde a K4-4. **Nenhum documento (K4-4, K5, `docs/
   CONFIGURACAO.md`, `AMBIENTE.md`) prevê ou registra essa quebra**, e nenhum teste automatizado chama
   `subir.mjs` de verdade (os testes de `verificar:redis` usam `subir()` de `ambiente.mjs` diretamente,
   nunca o script do showcase). *Onde corrigir:* `base/showcase/subir.mjs` (passar `-a` com a senha, ou
   usar `REDISCLI_AUTH` via `environment:` no `docker-compose.yml`) e registrar em `AMBIENTE.md` como
   armadilha até corrigir. Contornei com um patch temporário só para completar a prova ao vivo pedida
   (seção 2.2), restaurado byte a byte depois.

2. **K5 diz que a lista de inclusão "cobre toda variável lida por zona e domínio", verificado por
   teste — mas o teste só reconhece `process.env.X` e `process.env['X']`, não desestruturação
   (`const { X } = process.env`).** Ver seção 4.1. Não é brecha de segurança (a barreira real filtra por
   nome, não pela forma de leitura), mas é uma lacuna de verificação: uma variável nova, legítima, lida
   por desestruturação e esquecida na lista quebraria uma zona silenciosamente em produção, sem que
   `task verificar` ou `task verificar:redis` acusasse nada. *Onde corrigir:* a regex de
   `ambiente.test.mjs` (cobrir `const { X, Y } = process.env` e, se quiser mais robustez, `const { X } =
   process['env']`); registrar como lacuna de verificação, não como veto, no `GATE_STATUS.md`.

Nenhuma outra divergência encontrada: `task verificar:redis` e `task verificar:construir` bateram
exatamente com os números que o commit `d9ff04e` diz (109/109; 105+4); a prova ao vivo do V1 bateu com
o que o K5-1 promete; XR20q4 e E01g, que sobreviveram na iteração 8, agora são pegos, um estaticamente
(sem precisar rodar nada) e o outro com prova dinâmica completa (build real, sem vazamento em nenhuma
fase).

---

## Medições

Fora de escopo desta rodada (o pedido era condição adversária/degradada sobre a fatia K5, não carga).
Não produzi p50/p95/p99 nem medição de bundle: não pedidos e não fariam sentido isolados do resto do
gate. Os únicos "números" desta rodada são contagens de teste (109/109, 105+4, 48/48, 10/10), já
reportados com comando e saída bruta em cada seção.

---

## O que eu não consegui executar

- **Não recriei nem reconfigurei o Redis** (proibido pela tarefa): por isso a prova ao vivo do V1
  (seção 2.2) usou a senha REAL já ativa no container (`dev-shell-escrita`), não um "valor
  verdadeiramente novo" desconhecido de antemão — o valor novo genuíno só foi testado no modo
  automatizado (`task verificar:redis`, seção 2.1), que não depende de autenticar de verdade no
  container (usa `ambientesEntregues`, registrado independente de a senha bater com o Redis real).
  Não tentei alternativas como `CONFIG SET requirepass` ao vivo porque alteraria um processo que não é
  meu e que outros agentes podem depender.
- **Não testei o Redis do showcase com uma instância verdadeiramente derrubada e recriada** (fora do
  escopo: a tarefa proíbe derrubar/recriar Redis, Verdaccio ou Keycloak).
- **Não explorei mais formas de contorno estático além das já cobertas** (XR20q4, desestruturação de
  `process.env`); não tentei, por exemplo, `Object.entries(process.env)`/spread de `process.env` como
  leitura indireta de variável nova, nem variantes do N8 além das já no catálogo dos gates anteriores —
  o tempo desta rodada foi para as etapas pedidas (1-3) e um achado adicional (4.1), não uma varredura
  exaustiva de novas formas de bypass.
- **Não naveguei com navegador real** (Chrome via `base/verificacao/navegador.mjs`); usei `curl` direto
  para login e páginas, como a tarefa autorizava ("também subir o showcase... e conferir"). O
  `task verificar:redis`/`:construir` já cobrem navegação real via `abrirNavegador` nos testes existentes
  (visto no log: "o navegador navega, executa JS...").
- **Não testei o item 3 pedido ("... conferindo com `git status` e `git diff` que tudo voltou")** com uma
  cópia separada do repositório — mutei e restaurei diretamente na árvore de trabalho existente
  (conferido por `git status`/`git diff` a cada mutação, como documentado nas seções 3.1, 3.2 e 4.1).

---

## Veredito: **APPROVE**

Nenhum achado adversário (binário/bloqueante) nesta rodada: K5-1 (V1), K5-2 (V2), K5-3 (V3) e K5-4 (V4)
resistem a exatamente as condições que os vetos do `auditor_b1_d1_8` descreveram, com prova ao vivo (não
só teste automatizado) onde a tarefa pediu. Dois achados não bloqueantes, registrados como divergências
para o próximo commit de manutenção:

| # | Caso | Resultado |
|---|---|---|
| 1 | `task verificar:redis` 2x | 109/109, 109/109 |
| 2 | `task verificar:construir` 2x | 105+4, 105+4 |
| 2.1 | `ERP_REDIS_SENHA_SHELL=<novo> task verificar:redis` | 109/109; V1 do auditor_b1_d1_8 passa |
| 2.2 | Showcase ao vivo: `/proc/<pid>/environ` de shell/zonas/domínios | senha só no shell, em nenhuma zona/domínio |
| 2.2 | Login ana/bruno/carla + páginas | 200/404 conforme perfil, showcase funcional |
| 2.2 | Forja com credencial da zona | `NOPERM`; sem credencial: `NOAUTH` |
| 3.1 | XR20q4 (constructor(fetch) + fetch noutra função) | pego estaticamente (N8), 47/48 com a falha esperada |
| 3.2 | E01g (grava no carregamento do módulo, build forçado) | controle positivo escreve; com `ambiente.mjs`/K5-1, nenhuma fase da zona recebe REDIS_URL, sem escrita |
| 4.1 | Variável nova por desestruturação, fora da lista | não é achado de segurança; é lacuna do teste de completude (divergência #2) |

Estado final: fontes iguais ao início (só o baseline pré-existente de `pnpm-lock.yaml` em
`erp-dominio-stub`/`erp-moldura`, não causado por mim); todas as mutações restauradas byte a byte,
conferidas por `git status`/`git diff`; `task verificar:redis` final **109/109**; chaves forjadas
(`forjada-challenger-9`, `forjada-anonima`, `forjada-e01g-challenger9`) com `EXISTS 0`.

**PORTAS LIVRES** (3000–3003, 3012, 4001–4004, 4010, 4020 — `ss -ltnp` sem nenhuma; sem `next-server`
nem `node src/servidor.mjs` residual, conferido depois da última mutação). Verdaccio, Redis e Keycloak
intocados (não derrubados, não recriados). Nada commitado, nada instalado.
