# Handoff — reviewer_b1_d1_7

Gate: B1 + D1 + G3 (acesso v2) + fatias K3/K4, iteração 7. Revisor (Sonnet). 2026-09-23.
Escopo: `ec08ed1..HEAD` no repositório principal e nos submódulos `repos/erp-nucleo`
(00c4c6e..7b03871, sem novos commits desde a iteração 6) e `repos/erp-shell`
(cdde1a2..c8a3683, sem novos commits desde a iteração 6). Ênfase pedida: K4-3
(`base/scripts/ambiente.mjs`, `base/verificacao/base.test.mjs`) e `DEFERRED.md` D14 (XN09).
Critério: Decisão A2 (veto só para defeito de comportamento do produto ou erro plausível de
boa-fé; contorno deliberado de analisador enquadrado em D14 não veta).

## Veredito: **APPROVE**

## O que foi verificado

### 1. K4-3 corrige de fato o V1 (achado 1 do reviewer_b1_d1_6 / do challenger_b1_d1_6)

Lido `git show de421f5 -- base/scripts/ambiente.mjs base/verificacao/base.test.mjs
.agents/orchestrator/DEFERRED.md`. A correção:

```js
const iniciar = (cmd, args, cwd, envProc = env) => {
  const p = spawn(cmd, args, { cwd, env: envProc, stdio: log ? 'inherit' : 'ignore', detached: true })
  ...
}
```

`iniciar` agora declara e usa o 4º parâmetro. Os dois call sites que antes tinham o argumento
descartado (`subirApp`, linha ~135, e o laço final de `subir()`, linha ~171) continuam chamando
`iniciar('pnpm', ['start'], join(RAIZ, dir), envDaApp(dir))`, só que agora `envDaApp(dir)` chega
de fato ao `spawn`. `envDaApp` continua removendo `REDIS_URL` do ambiente de toda app que não seja
o shell. Confirmado que este era exatamente o bug relatado (assinatura de 3 parâmetros ignorando
silenciosamente o 4º argumento passado nas duas chamadas) — a mesma leitura de código do
`reviewer_b1_d1_6` e a mesma reprodução do `challenger_b1_d1_6` (`/proc/<pid>/environ` com
`REDIS_URL` presente nas 3 zonas, sessão forjada da carla aceita pelo shell).

`subirAppAvulsa` já usava `envDaApp(dir)` como base corretamente desde a K3 (não precisou mudar).

### 2. O teste V1 (E01f) tem dentes

`base/verificacao/base.test.mjs:911-924`: além de afirmar `!environ.includes('REDIS_URL=')` para
as 3 zonas, o teste agora afirma — só quando `process.env.REDIS_URL` está definido no processo de
teste (modo Redis) — que o **shell** *tem* `REDIS_URL=` no próprio `/proc/<pid>/environ`. Isso
prova que a leitura de `/proc/<pid>/environ` funciona de verdade (não passaria vazio por engano de
parsing) no mesmo ambiente em que a asserção das zonas roda. Com o bug da K3 de volta (reverter só
a assinatura de `iniciar` para 3 parâmetros, mantendo os call sites como estão), o 4º argumento
volta a ser descartado, `envProc` cai no valor padrão `env` (com `REDIS_URL`), e a primeira
asserção do teste (zonas sem `REDIS_URL=`) reprova nas 3 zonas — confirmado por leitura de
semântica de parâmetro padrão do JavaScript (mesma conclusão do `reviewer_b1_d1_6` e do
`challenger_b1_d1_6`, que reproduziram isso com a base real no ar, 96/98 com os dois testes
`base.test.mjs:482` e `:909` vermelhos). Não rodei eu mesmo `task verificar:redis` (portas
reservadas ao challenger desta rodada); a confirmação é por leitura de código mais a evidência já
registrada em `challenger_b1_d1_6/handoff.md` linhas 27-73, que não mudou de forma relevante entre
a iteração 6 e agora (só a correção do bug).

O teste em `base.test.mjs:482-491` (`V1 (auditor_b1_d1_3): zona com REDIS_URL e sem
REDIS_URL_ZONA...`) também ganhou uma asserção de dentes: `assert.ok(process.env.REDIS_URL, 'modo
Redis sem REDIS_URL no ambiente da verificacao')` antes de injetar `REDIS_URL` de propósito via
`envExtra`, confirmando que a variável realmente existe no processo de teste antes de forçá-la na
zona avulsa — evita que o teste passe vazio se `task verificar:redis` não tiver definido a
variável. A defesa de produto que esse teste cobre (`erp-zona-2/lib/redis.ts:26-32`,
`urlDaZona()`) já existe desde a iteração 3/K2: se `REDIS_URL` está definido sem
`REDIS_URL_ZONA`, a zona lança erro em vez de conectar como o shell — confirmei lendo o código-fonte
atual, não regrediu.

### 3. Nenhum outro processo da base recebe credencial que não deveria (checagem pedida)

- **Zonas** (`erp-zona-1`, `erp-zona-2`, `erp-zona-acesso`): corrigido pelo item 1, recebem
  `envDaApp(dir)` sem `REDIS_URL`, tanto no boot principal quanto no showcase
  (`base/showcase/subir.mjs` importa e usa o mesmo `subir()` de `ambiente.mjs`, sem caminho próprio
  de `spawn`).
- **Shell**: continua recebendo `env` completo (com `REDIS_URL`), correto — é quem grava sessão.
- **Domínios falsos** (`erp-dominio-stub`, `iniciar('node', ['src/servidor.mjs', nome], ...)`,
  linhas 102 e 159 de `ambiente.mjs`): não recebem `envProc` explícito, então usam o `env`
  completo (com `REDIS_URL`) por causa do padrão `envProc = env`. Não é uma regressão desta fatia
  (era assim antes também) e não é explorável pelo código do domínio: `grep` em
  `repos/erp-dominio-stub/src/*.mjs` mostra que só `DADOS_DIR` é lido de `process.env` — nada toca
  Redis ou sessão. **Observação, não bloqueia**: por princípio de menor privilégio o domínio
  simulado não precisaria da credencial de escrita do Redis no ambiente; diferente da zona, porém,
  o domínio-stub aqui é ferramenta de teste/showcase (representa um sistema externo que num deploy
  real nem seria subido por este script), não um processo do BFF em produção. Se quiserem fechar
  mesmo assim, é `iniciar('node', [...], ..., algumEnvSemRedisUrl)` nas linhas 102 e 159 — baixo
  custo, sem urgência.
- **Apps avulsas** (`subirAppAvulsa`, usada só por testes que injetam configuração incorreta de
  propósito): parte de `envDaApp(dir)` como base, igual às apps normais.

### 4. `DEFERRED.md` D14 — registro de XN09

`XN09` (`auditor_b1_d1_4/mutacoes.txt:87`: `assetPrefix: process.env.DOMINIO_A_URL` — inv. 11 —
lacuna, endereço interno no HTML) foi adicionado à tabela de classes aceitas de D14, na mesma linha
de `XN08`/`XR30` (rota de domínio repassada por `rewrites`/`NextResponse.rewrite`), com a defesa "o
domínio responde 401 sem credencial; bloqueio de saída de rede no deploy".

**Achado não bloqueante**: a defesa citada não cobre bem o mecanismo de XN09. `XN08`/`XR30` são
sobre a **zona** repassando uma rota para o domínio (o domínio ainda pode recusar por falta de
credencial, e o bloqueio de egress do processo da zona no deploy fecha o resto). `XN09` é sobre um
**endereço interno aparecendo no JavaScript servido ao navegador** via `assetPrefix` — quem tentaria
usar esse endereço é o navegador do usuário, não a zona; bloquear a saída de rede da zona no deploy
não impede o navegador de tentar (nem impede o vazamento de topologia interna em si, que já
aconteceu no momento em que o HTML/JS chega ao cliente). Isso não é um "contorno deliberado de
analisador" no sentido da Decisão A2 — é plausível que alguém escreva `assetPrefix:
process.env.DOMINIO_A_URL` por engano (por exemplo, reaproveitando uma variável errada ao configurar
um CDN), o que é exatamente o padrão "erro plausível de boa-fé que passa pelos testes" que a A2
manda vetar, não isentar. Como o `reviewer_b1_d1_6` já registrou (achado 6, não bloqueante), esta
lacuna já existe desde a iteração 4 e não piorou nesta fatia; meu achado adicional é que o
enquadramento em D14 tem a defesa errada para este caso específico, não só a ausência de teste.
**Correção sugerida**: separar `XN09` da linha de `XN08`/`XR30` em D14 com uma defesa própria (ex.:
"o endereço seria interno à rede de produção e inalcançável do navegador do usuário" — se for esse
o argumento real) e/ou adicionar um teste ao `seguranca-estatica.mjs`/`base.test.mjs` que reprove
`assetPrefix` apontando para uma origem que não seja um caminho relativo/estático conhecido, do
mesmo jeito que V5 (XN01p) já faz para `next.config.env`. Delegável ao `testes-invariantes`.

## Comandos rodados (sem usar portas da base)

- `task test`: contratos 20/20, núcleo 136/136, moldura 26/26, stub 43/43, shell 43/43 (zonas sem
  script `test`) — todos verdes.
- `task typecheck`: 0 erros nas 4 apps (erp-shell, erp-zona-1, erp-zona-2, erp-zona-acesso).
- `task verificar:estatica`: 39/39.
- `task scripts:test`: 14/14.
- `node base/scripts/verificar-lockstep.mjs`: `lockstep ok: @erp/nucleo 0.9.2 em 4 aplicacoes`.
- Não rodei `task verificar` / `task verificar:redis` (portas reservadas ao challenger desta
  rodada). A confirmação do fechamento efetivo de V1 no runtime real depende de
  `base.test.mjs:482` e `:909` passando com `task verificar:redis` — é o que o challenger desta
  iteração deve reproduzir; minha confirmação é por leitura de código e pela evidência já
  registrada (determinística, 2x) pelo `challenger_b1_d1_6` antes da correção.

## Fronteiras de camada e Multi-Zones (diff `ec08ed1..HEAD`)

Sem mudança de produto fora de `base/scripts/ambiente.mjs`, `base/verificacao/*` e
`Taskfile.yml` desde a iteração 6 (só o commit `de421f5`, que toca exatamente o que está descrito
acima). Núcleo e shell (submódulos) não ganharam commit novo desde a iteração 6 — nada a
re-revisar ali além do que `reviewer_b1_d1_6`/`challenger_b1_d1_6` já confirmaram (V2 fechado por
`fronteira.mjs`, teste `S17b`). `base/showcase/medicao-refresh-concorrente.mjs` (novo, D2/Decisão C)
fala HTTP direto com o Keycloak do showcase, fora do runtime do Next, com origem fixa — mesma classe
de exceção de `scripts/registrar-manifesto.ts`; fora da árvore que `N8` varre (`base/`, não
`repos/erp-*`), não reprova o invariante 4.

## Vetos e lacunas da iteração 4/6 — status final conferido nesta rodada

| # | Descrição | Estado |
|---|---|---|
| V1 (inv. 15) | zona recebia `REDIS_URL` de escrita (bug de plumbing na K3) | **Fechado** nesta fatia (K4-3) |
| V2 (inv. 15) | escritor de sessão embrulhado escapava da fronteira | Fechado desde a iteração 6 (`fronteira.mjs`), sem mudança |
| V3 (inv. 2) | `valorSeguro` aceitava `x.campo` objeto | Fechado desde a iteração 6/K4-1 (verificador de tipos), sem mudança |
| V4 (inv. 4) | `fetch` mascarado, `test/` aninhado, `next/dist/*` liberado | Fechado desde a iteração 6, sem mudança |
| V5 (inv. 11) | `next.config.env=` por atribuição, chave calculada | Fechado desde a iteração 6, sem mudança |
| L2 (If-Match fixo) | Fechado desde a iteração 6 | sem mudança |
| L3 (cache "fora" 1 ms) | Fechado desde a iteração 6 (só teste) | sem mudança |
| L1 (`P0-acao-protegida` contornável) | Lacuna aberta, sem mudança nesta fatia | consistente |
| L4 (`router.push` indireto) | Contorno deliberado, D14 | consistente |
| L5 / XN09 (`assetPrefix` endereço interno) | Registrado em D14, mas com defesa mal ajustada (achado acima) | não bloqueia |

## Por que APPROVE

O único achado bloqueante das duas rodadas anteriores (V1, "erro plausível de boa-fé" segundo o
critério A2: assinatura de função não atualizada quando o call site ganhou um parâmetro novo) está
corrigido de forma verificável: o parâmetro é declarado, usado no `spawn`, os dois call sites que
precisavam dele continuam passando `envDaApp(dir)`, e o teste que prova isso (`V1 (E01f)`) tem
dentes de verdade (afirma a ausência nas zonas **e** a presença no shell, no mesmo modo de execução).
Nenhum outro processo da base ganhou credencial indevida por este diff — a única exposição
remanescente (domínio-stub com `REDIS_URL` no ambiente, não utilizado pelo código do domínio) é
pré-existente, não é código de produto do BFF, e não constitui um caminho de exploração dado que o
domínio-stub não toca Redis. O achado sobre `XN09`/D14 é apontado, mas não muda o veredito: é uma
lacuna de classificação em documentação de limites já aceitos, não uma regressão de comportamento
introduzida por este diff, e já estava registrada como lacuna (sem veto) desde a iteração 4.

Todos os comandos rodados sem portas (`task test`, `task typecheck`, `task verificar:estatica`,
`task scripts:test`, `node base/scripts/verificar-lockstep.mjs`) passam limpos.
