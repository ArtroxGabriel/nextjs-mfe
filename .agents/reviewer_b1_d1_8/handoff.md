# Handoff — reviewer_b1_d1_8

Gate: B1 + D1 + G3 (acesso v2) + fatias K3/K4, iteração 8. Revisor (Sonnet). 2026-09-23.
Escopo: `ec08ed1..HEAD` no principal (commits `de421f5` K4-3, `66e3ba8` K4-4, `cced8e5` docs) e nos
submódulos `repos/erp-nucleo` (7b03871) e `repos/erp-shell` (c8a3683) — **sem commit novo em
nenhum dos dois desde a iteração 6**, confirmado por `git log`/`git ls-tree HEAD` (mesmos hashes
já revisados pelo reviewer_b1_d1_6/7). Ênfase pedida: K4-4.
Critério: Decisão A2 (veto só para defeito de comportamento do produto ou erro plausível de
boa-fé; contorno deliberado de analisador enquadrado em D14 não veta).

## Veredito: **APPROVE**

## O que foi verificado

### 1. K4-4 corrige de fato o achado bloqueante do challenger_b1_d1_7

Lido `git show 66e3ba8 -- Taskfile.yml base/scripts/ambiente.mjs base/showcase/docker-compose.yml
base/showcase/subir.mjs docs/CONFIGURACAO.md base/verificacao/base.test.mjs
base/verificacao/seguranca-estatica.mjs base/verificacao/seguranca-estatica.test.mjs
.agents/orchestrator/DEFERRED.md`.

O achado do challenger_b1_d1_7 era binário e comprovado: o usuário `default` do Redis do showcase
não tinha senha (`nopass`, `+@all` sobre `~*`); qualquer processo capaz de abrir uma conexão TCP
para `127.0.0.1:6379` — inclusive a própria zona, sem nunca ler `REDIS_URL` do ambiente — gravava
sessão e a fazia aceita pelo shell. A K4-4 fecha exatamente esse vetor:

- `base/showcase/docker-compose.yml:14-16`: `--requirepass "${ERP_REDIS_SENHA_SHELL:-dev-shell-escrita}"`
  no `redis-server`, além do `--user zona ...` já existente. Isto exige senha para o usuário
  `default` (o único com `+@all`), não só para `zona`.
- `Taskfile.yml:102` (`verificar:redis`) e `base/showcase/subir.mjs:33` passam a montar
  `REDIS_URL` com `default:<senha>@127.0.0.1:6379`, senha coerente com o padrão do compose e
  configurável por `ERP_REDIS_SENHA_SHELL` nos três lugares (Taskfile, compose, subir.mjs) — os
  três valores-padrão batem (`dev-shell-escrita`).
- `docs/CONFIGURACAO.md`: linha de `REDIS_URL` atualizada ("leva a senha do usuário de escrita, que
  só o shell conhece") e linha nova para `ERP_REDIS_SENHA_SHELL`, no mesmo commit da mudança de
  comportamento — cumpre a regra de "configuração" do `AGENTS.md` (parâmetro documentado, não
  escondido no código).
- Teste novo com dentes: `base/verificacao/base.test.mjs:459-470` (`V1 (challenger_b1_d1_7)`)
  abre uma conexão RESP crua **sem usuário nem senha** (`redisCru` só envia `AUTH` se
  `u.username || u.password`; zerando os dois, nenhum `AUTH` é enviado) e afirma `NOAUTH` na
  resposta ao `SET`, depois confirma via `EXISTS` (com a conexão autenticada do teste) que a chave
  não foi gravada. **Reverter só o `--requirepass` do compose reabre exatamente o cenário do
  challenger_b1_d1_7** (conexão anônima grava) e este teste captura isso de forma determinística —
  não depende de timing nem de contorno de analisador estático (é o servidor Redis real).

### 2. Domínios falsos não recebem mais credencial nenhuma do Redis (achado não bloqueante do
reviewer_b1_d1_7, item 3)

`base/scripts/ambiente.mjs`: `envDoDominio = { ...env }` com `delete envDoDominio.REDIS_URL` e
`delete envDoDominio.REDIS_URL_ZONA`, usado nas três chamadas de `iniciar('node', ['src/servidor.mjs', ...])`
(linhas do `subirDominio` e do laço em `subir()`). `registrar()` também trocou de `env` para
`envDaApp(dir)` (a zona que registra o manifesto não precisa de `REDIS_URL`, coerente com o
princípio de menor privilégio já aplicado às zonas desde a K4-3).

Mesmo teste (`base.test.mjs:467-469`) confere, para cada domínio em `ambiente.dominios` (novo campo
devolvido por `subir()`), que `/proc/<pid>/environ` não contém `REDIS_URL`. Fecha exatamente o que
o `reviewer_b1_d1_7` classificou como "observação, não bloqueia" na iteração 7.

### 3. XN09 sai de D14 com regra estática própria, como o `reviewer_b1_d1_7` pediu

`DEFERRED.md`: a linha de D14 que agrupava `XN08, XR30, XN09` na mesma defesa ("o domínio responde
401 sem credencial; bloqueio de saída de rede no deploy") agora só tem `XN08, XR30` — a defesa
continua fazendo sentido só para rota de domínio repassada por `rewrites`/`NextResponse.rewrite`,
não para endereço interno em `assetPrefix` (que vai ao navegador, não à zona).

`seguranca-estatica.mjs:452-457`: nova regra reprova `assetPrefix`/`basePath` no `next.config` cujo
valor não seja `StringLiteral` ou `NoSubstitutionTemplateLiteral` (ou seja, `process.env.X`,
variável, template com interpolação, chamada de função). Teste
`seguranca-estatica.test.mjs:255-261` prova as três formas de contorno relatadas (`process.env.DOMINIO_A_URL`
direto, por variável intermediária, por template com interpolação) e o caso positivo (`'/zona1-static'`,
`''`). Isto é exatamente o teste que o `reviewer_b1_d1_7` sugeriu ("do mesmo jeito que V5/XN01p já
faz"), e o achado dele (a defesa de D14 não cobria o mecanismo de XN09: quem exploraria é o
navegador, não a zona) fica resolvido — não é mais um "limite aceito", é um invariante com teste.

**Observação, não bloqueia**: a regra só olha `ts.isPropertyAssignment` — `assetPrefix` por chave
computada (`['assetPrefix']: x`) ou shorthand escaparia. Isto é a mesma classe "chave calculada"
já aceita em D14 (linha `XN02–XN04, XR28, XR31`, defesa "a zona não tem credencial nem endereço de
domínio que valha fora do registro de destinos" — aqui o argumento análogo é que quem escreveria
`next.config` por chave computada de propósito já teria acesso de escrita ao repositório da zona,
o que está fora do modelo de ameaça declarado). Não é uma regressão nem um erro plausível de
boa-fé novo introduzido por esta fatia; delegável ao `testes-invariantes` se quiserem fechar mesmo
assim.

## Comandos rodados (sem usar portas da base)

- `task test`: contratos 20/20, núcleo 136/136, moldura 26/26, stub 43/43, shell 43/43 — verdes.
- `task typecheck`: 0 erros nas 4 apps (erp-shell, erp-zona-1, erp-zona-2, erp-zona-acesso).
- `task verificar:estatica`: **40/40** (39 na iteração 7 + o teste novo `XN09 (K4-4)`).
- `task scripts:test`: 14/14.
- `node base/scripts/verificar-lockstep.mjs`: `lockstep ok: @erp/nucleo 0.9.2 em 4 aplicacoes`.
- Não rodei `task verificar` / `task verificar:redis` (portas reservadas ao challenger desta
  rodada). A confirmação do fechamento efetivo do achado do challenger_b1_d1_7 no runtime real
  depende de `task verificar:redis` (o novo teste só roda no modo Redis, `skip` sem
  `REDIS_URL_ZONA`) e da reprodução manual da forja de sessão sem senha — é o que o challenger
  desta iteração deve reproduzir; minha confirmação é por leitura de código e RESP/ACL do Redis
  (comportamento documentado do `redis-server`: `--requirepass` fixa a senha do usuário `default`,
  que é quem tinha `+@all`).

## Fronteiras de camada e Multi-Zones

Sem mudança de produto fora de `base/scripts/ambiente.mjs`, `base/showcase/*`, `base/verificacao/*`,
`Taskfile.yml` e `docs/CONFIGURACAO.md` desde a iteração 7. Núcleo e shell (submódulos) sem commit
novo — nada a re-revisar ali além do que as iterações 6/7 já confirmaram. Nenhum código de app
(`repos/erp-zona-*`, `repos/erp-shell`, `repos/erp-dominio-stub`) mudou nesta fatia: o ajuste é só
infraestrutura de verificação/showcase (fora do escopo dos invariantes 1-3, que falam do runtime
das apps) e configuração (invariante de "parâmetro em configuração", cumprido).

## Vetos e lacunas anteriores — status final conferido nesta rodada

| # | Descrição | Estado |
|---|---|---|
| V1 (inv. 15, iter. 4-6) | zona recebia `REDIS_URL` de escrita (bug de plumbing) | Fechado desde K4-3 |
| V1 "de verdade" (challenger_b1_d1_7) | `default` do Redis do showcase sem senha: endereço público bastava para forjar sessão | **Fechado nesta fatia (K4-4)**, com teste que reprova se revertido |
| Domínio-stub com `REDIS_URL`/`REDIS_URL_ZONA` no ambiente (reviewer_b1_d1_7, não bloqueante) | superfície desnecessária | **Fechado nesta fatia** |
| XN09 em D14 com defesa mal ajustada (reviewer_b1_d1_7, não bloqueante) | lacuna de classificação | **Fechado nesta fatia**: regra estática própria + teste, saiu de D14 |
| V2 (inv. 15, embrulho do escritor) | Fechado desde a iteração 6 (`fronteira.mjs`) | sem mudança, sem novo commit no núcleo |
| V3 (inv. 2, `valorSeguro`) | Fechado desde a iteração 6/K4-1 (verificador de tipos) | sem mudança |
| V4/V5 (inv. 4/11, saída de rede, `next.config`) | Fechados desde a iteração 6 | sem mudança |
| L1 (`P0-acao-protegida` contornável) | Lacuna aberta, sem mudança nesta fatia | consistente, não é escopo da K4-4 |
| L4 (`router.push` indireto) | Contorno deliberado, D14 | consistente |

## Por que APPROVE

O único achado bloqueante em aberto ao entrar nesta iteração — a "credencial de escrita" do Redis
do showcase não ser credencial nenhuma (usuário `default` sem senha) — está corrigido de forma
verificável: `--requirepass` no `default`, `REDIS_URL` das três fontes (Taskfile, compose,
subir.mjs) atualizado de forma consistente, documentação de configuração no mesmo commit, e um
teste que fala RESP cru com o Redis real (não um analisador estático, não é um caso de D14) e
reprova exatamente a exploração binária que o challenger_b1_d1_7 demonstrou. Os dois achados não
bloqueantes remanescentes das duas últimas iterações (domínio-stub com credencial não usada;
XN09 mal classificado em D14) também foram fechados nesta fatia, com teste. Não encontrei
regressão em nenhum invariante, nenhuma mudança de camada (`interno/`, `adaptadores/`,
`fabricas/`), nenhum novo caminho de rede fora do registro de destinos, e nenhum código de app
mudou. Todos os comandos rodados sem portas passam limpos (`task test`, `task typecheck`,
`task verificar:estatica` 40/40, `task scripts:test`, lockstep).

**Pendência que não muda o veredito, mas que o challenger/auditor desta iteração devem repetir**:
a prova de ponta a ponta do fechamento (tentar `SET` sem senha contra o Redis real do showcase e
confirmar `NOAUTH`, e repetir a tentativa de forja de sessão só com o endereço público) — eu só
confirmei por leitura de código e do teste novo, sem subir a base (portas reservadas ao challenger).
