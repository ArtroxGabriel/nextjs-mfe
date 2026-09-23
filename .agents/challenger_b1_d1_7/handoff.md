# handoff — challenger_b1_d1_7 (parcial)

Gate B1+D1+G3 (acesso v2) + fatias K3/K4, iteração 7. Escopo ec08ed1..HEAD (K4-3 em de421f5).
Critério: Decisão A2 (reprova defeito de produto ou erro plausível de boa-fé; contorno deliberado
dentro de D14 não reprova).

## Escopo lido
AGENTS.md, .agents/orchestrator/LEIA-PRIMEIRO.md, AMBIENTE.md, RETOMADA.md, GATE_STATUS.md
(iterações 4, 5, 6), DEFERRED.md (D14), .agents/challenger_b1_d1_6/handoff.md,
.agents/auditor_b1_d1_4/handoff.md e mutacoes.txt (127 mutações, catálogo/piso), diff
`git show de421f5 -- base/scripts/ambiente.mjs base/verificacao/base.test.mjs`.

## Estado inicial (antes de tocar em qualquer coisa)
- Portas 3000-3003, 3012, 4001-4004, 4010, 4020: todas **livres** (checagem `echo > /dev/tcp`,
  todas recusaram conexão). Nenhum processo `next-server`/`erp-dominio-stub`/`erp-shell`/
  `erp-zona-*` no `ps aux`.
- No ar, não são meus, não toco: Verdaccio (4873), Redis (6379), Keycloak (8080) do showcase.
- `git status` no principal: só `repos/erp-dominio-stub` e `repos/erp-moldura` com
  `pnpm-lock.yaml` modificado (hash local do Verdaccio, armadilha conhecida — ignorado por
  instrução explícita do despacho). Untracked: `.agents/reviewer_b1_d1_7/` (agente paralelo,
  não meu).
- Submódulos: `erp-contratos`, `erp-nucleo`, `erp-shell`, `erp-zona-1`, `erp-zona-2`,
  `erp-zona-acesso` sem diff nenhum.

## Etapa 1 — baseline

`task verificar:redis`, 2 execuções independentes (cada uma sobe e derruba a base sozinha):
```
1ª: tests 98, pass 98, fail 0, skipped 0  (duration_ms 36683.5)
2ª: tests 98, pass 98, fail 0, skipped 0  (duration_ms 36968.1)
```
**98/98 nas duas.** Os dois testes que reprovavam na iteração 6 (`base.test.mjs:482` e `:909`,
o V1 do challenger_b1_d1_6) agora passam.

`task verificar` (modo arquivo), 2 execuções independentes:
```
1ª: tests 98, pass 95, fail 0, skipped 3  (duration_ms 35023.6)
2ª: tests 98, pass 95, fail 0, skipped 3  (duration_ms 33988.5)
```
**95 + 3 pulados nas duas** (os 3 pulados são os testes `skip: !process.env.REDIS_URL...`, só
valem no modo Redis — comportamento esperado, documentado no próprio teste).

Depois das 4 execuções, portas 3000-3003, 4001-4004, 4020 conferidas livres de novo
(`echo > /dev/tcp`) e nenhum `next-server`/`erp-dominio-stub` residual no `ps aux`: cada `task`
sobe e derruba a própria base sem deixar processo para trás.

## Base persistente no ar (para as sondas)

Controlador Node dedicado (script em
`/tmp/.../scratchpad/subir-persistente.mjs`, chama `subir({construir:false})` de
`base/scripts/ambiente.mjs`), servidor de controle HTTP em `127.0.0.1:39998` (loopback, só meu).
`REDIS_URL=redis://127.0.0.1:6379`, `REDIS_URL_ZONA=redis://zona:dev-zona-leitura@127.0.0.1:6379`
(mesmos valores de `task verificar:redis`). PIDs iniciais: shell 166320 (pnpm)/166482 (sh)/166512
(next-server), zona1 166321/166531/166539, zona2 166323/166514/166533, acesso 166325/166544/166546.
Domínios: dominio-a 166160, dominio-b 166161, dominio-c 166162, plataforma 166163,
gestao-acesso-v2 166164. Portas 3000-3003, 4001-4004, 4020 ocupadas por mim.

## Etapa 2 — V1 de verdade (/proc/<pid>/environ, forja de sessão)

### 2.1 — `/proc/<pid>/environ` de toda a árvore (zonas, filhos do pnpm, next-server, e domínios)

Zonas — nenhum nível do processo (pnpm start, `sh -c next start`, `next-server`) tem `REDIS_URL`;
todos têm `REDIS_URL_ZONA` (leitura). Shell tem `REDIS_URL` (escrita) nos 3 níveis, como esperado:
```
erp-zona-1:pnpm (166321)        REDIS_URL=[] REDIS_URL_ZONA=[...zona:dev-zona-leitura...]
erp-zona-1:sh   (166531)        REDIS_URL=[] REDIS_URL_ZONA=[...]
erp-zona-1:next-server (166539) REDIS_URL=[] REDIS_URL_ZONA=[...]
(idem erp-zona-2 166323/166514/166533 e erp-zona-acesso 166325/166544/166546)
erp-shell:pnpm  (166320)        REDIS_URL=[redis://127.0.0.1:6379] REDIS_URL_ZONA=[...]
erp-shell:sh    (166482)        REDIS_URL=[redis://127.0.0.1:6379] REDIS_URL_ZONA=[...]
erp-shell:next-server (166512)  REDIS_URL=[redis://127.0.0.1:6379] REDIS_URL_ZONA=[...]
```
**A correção K4-3 está em vigor no runtime real, em toda a árvore de processos das 3 zonas**
(não só no `spawn` imediato — o `next-server`, neto do `spawn`, também não tem `REDIS_URL`
herdada, porque `envProc` já não a continha desde a raiz).

**Achado novo — domínios recebem `REDIS_URL` sem usá-la:**
```
dominio-a (166160)        REDIS_URL=[redis://127.0.0.1:6379]
dominio-b (166161)        REDIS_URL=[redis://127.0.0.1:6379]
dominio-c (166162)        REDIS_URL=[redis://127.0.0.1:6379]
plataforma (166163)       REDIS_URL=[redis://127.0.0.1:6379]
gestao-acesso-v2 (166164) REDIS_URL=[redis://127.0.0.1:6379]
```
`grep -rn "REDIS_URL" repos/erp-dominio-stub/src/` → vazio: o código do stub nunca lê essa
variável. Causa: `subirDominio` em `ambiente.mjs` chama `iniciar('node', [...], ...)` sem 4º
argumento, então usa o `env` completo (o mesmo que o shell recebe). Não é invariante 15 (que fala
de "zona", e o domínio-stub não é uma zona: é o mock do domínio externo, não roda `@erp/nucleo`).
Não é bloqueante por si (o domínio-stub não é o alvo de confiança da arquitetura — na v2 de
produção o domínio já é quem decide o que o usuário vê, ADR-0009), mas é uma superfície
desnecessária: **divergência**, não invariante violado. Registrada na seção 2 abaixo.

### 2.2 — Tentativa de repetir a forja **só com o que a zona tem** (`REDIS_URL_ZONA`, ACL leitura)

Script rodado dentro de `erp-zona-1` (mesmo `node_modules`, nenhum pacote novo), usando **só**
`redis://zona:dev-zona-leitura@127.0.0.1:6379` (a única credencial no ambiente real da zona):
```
conectou como usuario ACL da zona
GET antes de escrever (deveria funcionar, leitura): null
SET RECUSADO (esperado): NOPERM User zona has no permissions to run the 'set' command
DEL RECUSADO (esperado): NOPERM User zona has no permissions to run the 'del' command
```
**Com a credencial de leitura sozinha, a forja falha** (`NOPERM`). Até aqui, a defesa declarada
funciona.

### 2.3 — ACHADO BLOQUEANTE — a "credencial de escrita" do shell não é uma credencial: `default` é `nopass`

```
$ redis-cli ACL LIST   (via cliente Node, sem nenhuma credencial)
user default on nopass sanitize-payload ~* &* +@all
user zona on sanitize-payload #d866796e... ~erp:sessao:* resetchannels -@all +get +@connection
```
`REDIS_URL=redis://127.0.0.1:6379` (o valor exato hardcoded em `Taskfile.yml`, commitado no
repositório, público) **não tem usuário nem senha** — é literalmente a conexão anônima ao usuário
`default`, que tem `+@all` sobre `~*`. `base/showcase/docker-compose.yml` define ACL só para o
usuário `zona`; nunca define `--requirepass` nem restringe `default`. O comentário no compose
("`default` é do shell, único escritor") descreve uma intenção de uso, não uma restrição técnica:
**qualquer processo capaz de abrir uma conexão TCP para `127.0.0.1:6379` — inclusive a própria
zona, que roda no mesmo host e portanto tem a rede — pode se autenticar como `default` sem
nenhum segredo** e tem escrita total, nunca precisando ler `REDIS_URL` do ambiente.

Repeti a forja de sessão da carla **exatamente como no despacho, mas explicitamente sem nunca
ter `REDIS_URL` disponível** (`process.env.REDIS_URL` confirmado `undefined` no script, rodado
dentro de `erp-zona-1`, sem nenhum pacote novo):
```
process.env.REDIS_URL visto pelo processo (deve ser vazio, e nao usamos mesmo assim): undefined
ANTES existia? null
GRAVOU chave erp:sessao:a8ac3f41e29bb028226a1fa66dc270e576cea6d67a91667cb0c5e813af607e24
DEPOIS {"sub":"carla","nome":"Carla (forjada it7, sem REDIS_URL no ambiente)", ...}
```
Uso do cookie forjado no shell (único endpoint que um navegador alcança):
```
$ curl -i -H "Cookie: __Host-session=forjada-challenger-b1-d1-7-sem-env" http://localhost:3000/
status=200   "Olá, Carla (forjada it7, sem REDIS_URL no ambiente)"  módulos: Início, Zona 1, Gestão de acesso

$ curl -o /dev/null -w "%{http_code}\n" -H "Cookie: __Host-session=forjada-challenger-b1-d1-7-sem-env" http://localhost:3000/acesso
200   # Gestão de acesso, sem nenhuma credencial real, sem nunca ter lido REDIS_URL

$ curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/   # controle, sem cookie
307
```
Chave apagada depois (`DEL` -> 1, `EXISTS` -> 0), confirmado; a chave de teste `x` de uma sonda
anterior (ACL GETUSER) também foi apagada (`DEL` -> 1, `EXISTS` -> 0).

**Isto é o achado mais grave desta iteração: a correção K4-3 (remover `REDIS_URL` do ambiente da
zona) fecha o canal "ler a variável de ambiente", mas não fecha o ataque em si.** A premissa de
todo o V1 (iterações 3-6) — "a zona não tem a credencial de escrita" — é falsa na origem: não
existe credencial de escrita nenhuma a proteger, porque o usuário que o shell usa não exige
nenhuma. O único obstáculo real entre qualquer código rodando no processo da zona (dependência
comprometida, SSRF, bug de configuração) e a escrita de sessão é a zona **não saber o endereço**
— e o endereço (`redis://127.0.0.1:6379`) está hardcoded em texto claro em `Taskfile.yml`, que é
parte do próprio repositório que a zona roda. Repetido 1x, determinístico (mesma classe de ataque
provada 2x nesta rodada: uma vez com a leitura de `/proc` de outro processo — nem precisei disso —
e uma vez com conexão direta sem nenhum dado do ambiente).

### 2.4 — Controle: cookie forjado sem sessão real, direto na zona e pelo shell
```
curl -H "Cookie: __Host-session=nao-existe-no-redis-it7" http://127.0.0.1:3001/zona1  -> 307
curl -H "Cookie: __Host-session=nao-existe-no-redis-it7" http://localhost:3000/zona1  -> 307
```
Sem uma chave real (mesmo escrita por qualquer usuário do Redis), o cookie sozinho nunca autoriza.

## Etapa 3 — V3, V5, If-Match, 401/404/403, revogação

### V3 (inv. 2) — reconfirmado ponta a ponta com mutação de boa-fé (`extra={ {resumo:custo}.resumo }`)

1. Mutação idêntica em espírito à do despacho (`erp-zona-1/app/zona1/page.tsx` +
   `BotaoDeAviso.tsx`, prop `extra?: unknown`, tipo de `custo` é objeto `{valor, centro}`).
   `node --test base/verificacao/seguranca-estatica.test.mjs` com a mutação em disco:
   ```
   ✖ erp-zona-1/app/zona1/page.tsx:34 [P0-dto-sensivel] valor nao projetado na prop 'extra' da ilha <BotaoDeAviso>
   ```
   Reprova, como o K4 promete (decide pelo tipo do TypeScript, não pelo nome do campo).
2. Sem o analisador: derrubei **só** a zona-1 (`kill -TERM` no grupo, shell/zona-2/acesso
   intocados), `pnpm build` com a mutação, subi isolada na porta 3001 com o ambiente real da zona
   (`REDIS_URL_ZONA`, sem `REDIS_URL`). Login real como `bruno` pelo shell
   (`POST /api/auth/entrar`), cookie de sessão real (não forjado). Pedido a `/zona1` direto na
   porta 3001 e pelo shell (porta 3000, que roteia para a zona):
   ```
   $ curl -H "Cookie: __Host-session=<sessao real de bruno>" http://127.0.0.1:3001/zona1
   data-extra="{&quot;valor&quot;:1200,&quot;centro&quot;:&quot;CC-10&quot;}"

   $ curl -H "Cookie: __Host-session=<sessao real de bruno>" http://localhost:3000/zona1
   ... "CC-10" ... no payload RSC (["$","div",...,"extra":{"valor":1200,"centro":"CC-10"}}]])
   ```
   **O centro de custo (`CC-10`) vazou para bruno**, tanto direto na porta da zona quanto pelo
   shell — confirma que, sem o analisador K4, o defeito de boa-fé chegaria à produção.
3. Reverti (`git checkout -- app/zona1/page.tsx app/zona1/BotaoDeAviso.tsx`), `git status`
   vazio, `pnpm build` de novo, zona-1 limpa subida no mesmo lugar (porta 3001, mesmo ambiente).
   `/zona1` como bruno pelo shell: `grep -c "CC-10|mutacao-challenger-7|data-extra"` → **0**.

**Veredito: V3 sustentado**, com prova ponta a ponta (não só automatizada) nesta iteração.

### If-Match (invariante 6) — `concluirTarefa` (zona2, t-2), actor real `ana` (dono do módulo), campos do formulário renderizado

Estado real no domínio conferido antes/depois de cada tentativa (via `acaoPeloCliente`, o mesmo
caminho de um navegador com JS — `Next-Action` + `encodeReply` — porque a Server Action sempre
devolve HTTP 200 mesmo quando o efeito é recusado):
```
ANTES:                  t-2 { concluida: false, versao: 1 }
versao=99 (inventada)   -> HTTP 200, DEPOIS: { concluida: false, versao: 1 }  (nao mudou)
sem campo versao        -> HTTP 200, DEPOIS: { concluida: false, versao: 1 }  (nao mudou)
versao=1 (do form real) -> HTTP 200, DEPOIS: { concluida: true,  versao: 2 }  (mudou)
```
**OK**: só a versão correta muta o estado.

### CSRF / invariante 5 — Origin de outro site em `concluirTarefa` (t-1)
```
ANTES: t-1 { concluida: false, versao: 3 }
Origin=http://evil.example -> HTTP 500, sem cookie __Host-flash, DEPOIS: { concluida: false, versao: 3 }
```
**OK**: recusa, sem mudança de estado (o 500 é o comportamento conhecido de Server Action com
`Origin` inválido — o Next recusa antes de `acaoProtegida` rodar).

### 404 uniforme (invariante 7) — carla em `/zona1/recursos/r-3` (fora do escopo dela) × id inexistente

```
status r-3 = 404, status r-999-nao-existe = 404
```
Corpo comparado byte a byte após normalizar só o `nonce` (nas duas formas, texto e dentro do
payload RSC escapado) e o próprio segmento de id ecoado de volta na árvore de rota (esperado,
não é sinal de existência — é o path que o cliente pediu, igual para os dois casos):
**idênticos**. Não fiz a medição estatística de tempo (n≥500): não fazia parte do despacho desta
iteração e não há mudança de código no caminho de 404 desde a iteração 4 que justificasse o custo
de repetir a medição de novo (registrada como lacuna desde então, não como "passou").

### Perfil administrativo (carla, gestão de acesso) em `/zona1/recursos/r-1` — sem `custo`
```
status 200, /custo/i no HTML? false, /CC-\d/ no HTML? false
```
**OK**: papel administrativo (gestão de acesso) não concede o dado de negócio de outra zona.

### Revogação sem novo login (D7), com formulário real da página `/acesso`
```
davi /zona1 ANTES                         -> 200
formulario real de revogacao: { acesso: 'ac-09', pessoa: 'p-20', modulo: 'zona1' }
revogarAcesso (carla)                     -> HTTP 200, destino "/acesso"
davi /zona1 DEPOIS (mesma sessao)         -> 404
davi menu contem "/zona1"?                -> false
concederAcesso (restaurar, carla)         -> HTTP 200, destino "/acesso"
davi /zona1 restaurado                    -> 200
```
**OK**: o módulo some já na próxima requisição, sem novo login — D7 sustentado. Estado do
domínio restaurado ao original (a concessão original tinha id `ac-09`; a nova concessão de
restauração pode ter id diferente no domínio, mas o efeito observável — acesso de davi a zona1 —
é o mesmo; dado só em memória no domínio-stub, sem `DADOS_DIR`, então some ao derrubar o processo).

Nota: minha primeira tentativa destas sondas usou nomes de campo inventados (`usuario`, `modulo`
sem `pessoa`/`acesso`) e deu falso-negativo silencioso (HTTP 200 sem nenhum efeito, porque o
domínio provavelmente recusou por campo ausente e a Server Action normaliza para toast, não para
status de erro). Descartei essa tentativa e refiz lendo o formulário real da página (`formularios()`
+ `pedir('/acesso')`), como o próprio `base.test.mjs` faz — o resultado acima é dessa segunda
rodada, com os campos que a página de fato renderiza.

### Domínio direto sem `Authorization` / com `Authorization` inválido / com `Origin` de navegador
```
sem Authorization                          -> 401 {"codigo":"SESSAO_EXPIRADA"}
Authorization: Bearer lixo-invalido        -> 401 {"codigo":"SESSAO_EXPIRADA"}
Origin: http://localhost:3000 (sem Auth)   -> 403 {"codigo":"OPERACAO_NAO_PERMITIDA"}
Origin: http://evil.com (sem Auth)         -> 403 {"codigo":"OPERACAO_NAO_PERMITIDA"}
```
**OK**: recusa sem credencial e com credencial inválida (401, corpo normalizado, sem stacktrace,
sem `SELECT`, sem nome de classe); **qualquer** `Origin` de navegador (legítimo ou não) é recusado
com 403 antes mesmo de olhar a credencial — o domínio é inalcançável fora do processo Node do BFF,
como a "composição no servidor" promete.

### Parâmetro de destino hostil (registro de destinos, ADR-0009) — parcial

Li o código (`repos/erp-nucleo/src/interno/destinos.ts`, `montarUrl`): `DestinoInvalido` é lançado
**antes** de qualquer `fetch` para `.`, `..`, valor vazio, >256 chars ou byte de controle no
parâmetro; barras (`//evil.com`) são neutralizadas por `encodeURIComponent` e a origem final é
sempre `d.url.origin` (o registro), nunca o parâmetro. Comportamental, via URL:
```
id=//evil.com (encodado)  -> 404 (segmento vira %2F%2Fevil.com, dominio nao acha, sem chamada externa)
id=%00 (byte de controle) -> 404
id=..  ou  id=%2E%2E      -> 308 (o roteador do Next normaliza o path ANTES de chegar na minha rota
                              dinamica; não consegui exercitar o `id==='..'` do jeito HTTP puro)
```
Não fiz o teste que isolasse o parâmetro do roteamento de URL (ex.: um formulário que manda `id`
como campo de POST, não como segmento de path) — ficaria mais fiel ao caminho que `montarUrl`
realmente valida. A leitura de código sustenta a defesa; a parte comportamental está incompleta
para `..` especificamente (registrado em "Não executado").

### Varredura de bundle estático e HTML por endereço interno e token (invariantes 1 e 11)
```
grep -rlE "127\.0\.0\.1:40[0-9][0-9]|redis://" erp-*/.next/static/  -> vazio
grep -oE "accessToken|access_token|refresh_token" no HTML de /zona1 (bruno, sessao real)  -> vazio
```

## Limpeza — concluída

1. Controlador próprio (`subir-persistente.mjs`) recebeu `/derrubar`: derrubou shell, as 4 apps
   rastreadas por ele e os 5 domínios.
2. A zona-1 foi derrubada e resubida **fora** do controlador duas vezes (mutação de V3 e depois
   limpa), do mesmo jeito documentado pelo challenger_b1_d1_6 — não ficou no `Map` do controlador,
   então matei à mão (`kill -9` nos PIDs do `pnpm`/`sh`/`next-server`, confirmado por `ss -tlnp`)
   depois do `/derrubar`. Porta 3001 confirmada livre.
3. Chaves forjadas no Redis apagadas e confirmadas: `erp:sessao:<sha256('forjada-challenger-b1-d1-7-sem-env')>`
   (`DEL` -> 1, `EXISTS` -> 0) e a chave de teste `x` da sonda `ACL GETUSER`/escrita anônima
   (`DEL` -> 1, `EXISTS` -> 0). Não fiz `FLUSHALL`; as `erp:sessao:*` restantes são sessões normais
   dos meus `entrar()` desta rodada, com TTL, igual ao padrão dos challengers anteriores.
4. Mutação de código (V3) revertida e conferida: `erp-zona-1/app/zona1/page.tsx` e
   `.../BotaoDeAviso.tsx` voltaram ao original (`git checkout --`), `git diff --stat` vazio,
   reconstruídos e a versão limpa foi a última a rodar e a ser derrubada.
5. `git status` do principal e dos 8 submódulos, conferido no fim: **idêntico ao estado inicial**
   — só os dois `pnpm-lock.yaml` (`erp-dominio-stub`, `erp-moldura`) com o diff de hash local já
   presente antes de eu começar (ignorado por instrução do despacho). `erp-zona-1` sem diff.
   `.agents/challenger_b1_d1_7/` é este handoff; `.agents/reviewer_b1_d1_7/` é processo paralelo,
   não meu. Nada commitado, instalado nem enviado.
6. Dados do domínio-stub: só em memória (sem `DADOS_DIR`) nas 5 instâncias que usei — tudo que
   mutei (t-2 concluída, revogação/concessão de davi em zona1, a escrita anônima de teste no
   Redis) sumiu com o processo ao derrubar; `repos/erp-dominio-stub/dados/` não foi tocado
   (`git status` confirma, só o `pnpm-lock.yaml` conhecido).
7. Portas 3000-3003, 3012, 4001-4004, 4010, 4020 e a de controle 39998: todas **livres**,
   conferido por `echo > /dev/tcp` e por `ps aux`/`ss -tlnp` (nenhum `next-server`/
   `erp-dominio-stub`/`erp-shell`/`erp-zona-*` residual). Verdaccio (4873), Redis (6379) e
   Keycloak (8080) do showcase: intocados, continuam no ar como estavam antes de eu começar.

**Portas liberadas: sim. O auditor pode começar.**

## Não executado / lacunas de execução

- **Timing estatístico n≥500 do 404** (existente-fora-de-escopo × inexistente): não fazia parte
  do despacho desta iteração; nenhuma mudança de código no caminho de 404 desde a iteração 4
  justificaria repeti-lo. Continua em aberto desde a iteração 4 (registrado lá, não "passou").
- **Parâmetro `..` do registro de destinos por HTTP puro**: não consegui isolar o parâmetro do
  roteamento de URL do Next (`/zona1/recursos/..` e `/zona1/recursos/%2E%2E` são normalizados pelo
  próprio Next antes de chegar à rota dinâmica, viram `308` para `/zona1`). A defesa
  (`montarUrl` em `erp-nucleo/src/interno/destinos.ts` rejeita `v === '..'` antes do `fetch`) está
  confirmada só por leitura de código nesta rodada, não por comportamento observado para este caso
  específico; `//evil.com` e byte de controle **foram** exercitados comportamentalmente (404, sem
  chamada externa).
- **Redis fora do ar / rede lenta entre BFF e domínio**: não simulei — fora do escopo do despacho
  desta iteração (V1, V3, V5, If-Match, 401/404/403, revogação) e o Redis é do showcase,
  compartilhado, não é meu para derrubar.
- **Medição 1 (concorrência de renovação de refresh token no Keycloak)** e
  `base/showcase/medicao-refresh-concorrente.mjs`: fora do escopo (D2, núcleo ainda 0.9.2, sem
  OIDC/PKCE nesta base).
- **Não fiz uma auditoria linha a linha completa de `Taskfile.yml`** além do que precisei para
  entender `REDIS_URL`/`REDIS_URL_ZONA`; pode haver outras divergências de infraestrutura de teste
  não descobertas.
- **Achado do `default` `nopass` do Redis**: testado só nesta máquina, uma vez para escrita
  (`SET`) e uma vez para o ciclo completo de forja+login (determinístico, sem motivo para esperar
  variação — é configuração estática do `docker-compose`, não condição de corrida). Não testei se
  a mesma falha se repete com o Redis do `task verificar:redis` reiniciado do zero (só testei
  contra a instância do showcase já no ar, que é a mesma que `task verificar:redis` usa).

## Veredito: **REQUEST_CHANGES**

**Achado adversário bloqueante e binário, mais grave que o da iteração 6**: a fatia K4-3 corrige
exatamente o que o despacho pedia — nenhum processo de zona (incluindo o `next-server`, neto do
`spawn`) tem `REDIS_URL` em `/proc/<pid>/environ`, em toda a árvore, confirmado — mas a garantia de
fundo do invariante 15 ("a zona não tem a credencial de escrita") continua falsa, porque **não
existe credencial nenhuma protegendo a escrita**: o usuário `default` do Redis do showcase
(`base/showcase/docker-compose.yml`) é `nopass` com `+@all` sobre `~*`. `REDIS_URL=redis://127.0.0.1:6379`
não é um segredo — é a string de conexão anônima, hardcoded em texto claro em `Taskfile.yml`
(committado). Qualquer código capaz de abrir uma conexão TCP para `127.0.0.1:6379` — o que inclui
o próprio processo da zona, que roda no mesmo host e portanto tem acesso de rede à porta — escreve
e apaga qualquer chave, sem nunca precisar ler `REDIS_URL` do ambiente e sem nenhum passo a mais
além de conhecer um endereço público. Provei isto de ponta a ponta: com `process.env.REDIS_URL`
confirmado `undefined`, escrevi uma sessão forjada da `carla` (perfil de gestão de acesso) e o
shell a aceitou em `/` e em `/acesso`, sem nenhuma credencial real, sem nunca ter lido a variável
de ambiente que as três últimas iterações trataram como o problema central.

Isto não é um contorno deliberado de analisador estático (D14 não se aplica: não há analisador
nenhum no caminho, é o servidor Redis real, medido com `ACL LIST`/`ACL GETUSER` e explorado com um
`SET` de verdade) e não é um erro plausível de boa-fé isolado num arquivo de código — é uma lacuna
de configuração de infraestrutura (`base/showcase/docker-compose.yml` nunca definiu `requirepass`
nem restringiu `default`) documentada de forma enganosa (`docs/CONFIGURACAO.md` e o comentário do
compose descrevem `REDIS_URL` como "a credencial de escrita do shell", dando a entender que é um
segredo comparável a `REDIS_URL_ZONA`, quando na verdade autentica sem nada). Pelo critério A2,
isto reprova: é exatamente o tipo de defeito de produto (a barreira real que os documentos alegam
existir não existe) que a Decisão A2 manda vetar, e está dentro do escopo explícito desta
iteração (V1 "de verdade").

**Achado não bloqueante (divergência, registrado, não invariante violado)**: os 5 processos de
domínio-stub recebem `REDIS_URL` sem nunca usá-la (mesma causa raiz de plumbing em `ambiente.mjs`,
mas em `subirDominio`, não em `subirApp`/`iniciar`) — superfície desnecessária, não é invariante 15
(domínio-stub não é zona), mas some para grátis se a correção do achado bloqueante acima incluir
alguma forma de autenticação real no Redis.

**Os demais itens do despacho sustentam**, todos com evidência bruta acima e sem achado novo: V3
(reconfirmado ponta a ponta com rebuild real, não só automatizado), If-Match, CSRF/Origin em
Server Action, 404 uniforme (corpo idêntico), perfil administrativo sem `custo`, domínio recusando
sem credencial ou com `Origin` de navegador, revogação sem novo login (D7), varredura de bundle e
HTML sem token/endereço interno. Isoladamente nenhum deles justificaria reprovar; o gate reprova
pelo achado da seção 2.3.

**Correção sugerida** (não implementei — challenger não corrige produto/infra): `--requirepass`
no usuário `default` do `redis-server` no `base/showcase/docker-compose.yml`, com a senha vinda de
variável de ambiente documentada (`docs/CONFIGURACAO.md`, padrão de dev público como já é o
`ERP_REDIS_SENHA_ZONA`) e usada em `REDIS_URL` do shell; e, já que está mexendo no arquivo, dar ao
domínio-stub (`subirDominio` em `ambiente.mjs`) um ambiente sem `REDIS_URL` também, pelo mesmo
`envDaApp`-like que a K4-3 já criou para as zonas. O critério de fechamento não é analisador nem
teste de `/proc/<pid>/environ` (esse já passa): é um teste que tente `SET`/`AUTH` sem senha contra
o Redis e exija recusa, e a repetição desta seção 2.3 com a defesa em vigor.
