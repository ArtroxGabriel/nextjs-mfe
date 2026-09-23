# handoff — challenger_b1_d1_8

Concluído: 2026-09-23.

Gate B1+D1+G3 (acesso v2) + fatias K3/K4, iteração 8. Escopo: correção K4-4 (66e3ba8) sobre a
reprovação da iteração 7 (Redis `default` `nopass`). Critério: Decisão A2 (reprova defeito de
produto ou erro plausível de boa-fé; contorno deliberado dentro de D14 não reprova).

## Escopo lido
AGENTS.md, .agents/orchestrator/LEIA-PRIMEIRO.md, AMBIENTE.md, RETOMADA.md, GATE_STATUS.md
(iterações 4 a 7), DEFERRED.md (D14), .agents/challenger_b1_d1_7/handoff.md e
.agents/challenger_b1_d1_6/handoff.md, .agents/auditor_b1_d1_4/handoff.md e mutacoes.txt (127
mutações, catálogo/piso), diff `git show 66e3ba8` (K4-4: `--requirepass` no Redis do showcase,
remoção de `REDIS_URL`/`REDIS_URL_ZONA` do ambiente dos domínios falsos, regra estática XN09).

## Estado inicial (antes de tocar em qualquer coisa)
- Portas 3000-3003, 3012, 4001-4004, 4010, 4020: todas **livres** (`echo > /dev/tcp`, todas
  recusaram). Nenhum processo `next-server`/`erp-dominio-stub`/`erp-shell`/`erp-zona-*` no `ps aux`.
- No ar, não são meus, não toco: Verdaccio (4873), `erp-showcase-redis-1` (6379),
  `erp-showcase-keycloak-1` (8080).
- `git status` no principal: só `repos/erp-dominio-stub` e `repos/erp-moldura` com
  `pnpm-lock.yaml` modificado (hash local do Verdaccio, armadilha conhecida — ignorado por
  instrução explícita do despacho). Untracked: `.agents/reviewer_b1_d1_8/` (agente paralelo, não
  meu).
- Submódulos: todos no `master`, sem diff além dos dois lockfiles acima.

## Etapa 1 — baseline

Confirmação prévia direta no Redis do showcase (fora do teste): `ACL LIST` via `docker exec` mostra
`user default on ...` (com hash de senha, não mais `nopass`); `redis-cli PING` sem credencial e
`SET testeanon x` sem credencial → `NOAUTH Authentication required.` nos dois. O Redis já foi
recriado com `--requirepass` antes desta rodada, como o despacho informou.

`task verificar:redis`, 2 execuções independentes:
```
1ª: tests 100, pass 100, fail 0, skipped 0  (duration_ms 36624.1)
2ª: tests 100, pass 100, fail 0, skipped 0  (duration_ms 38156.5)
```
**100/100 nas duas**, como esperado pelo despacho.

`task verificar` (modo arquivo), 2 execuções independentes:
```
1ª: tests 100, pass 96, fail 0, skipped 4  (duration_ms 34105.5)
2ª: tests 100, pass 96, fail 0, skipped 4  (duration_ms 33870.0)
```
**96 + 4 pulados nas duas**, como esperado.

Entre e depois das 4 execuções, portas 3000-3003, 3012, 4001-4004, 4010, 4020 conferidas livres
(`echo > /dev/tcp`) e nenhum `next-server`/`erp-dominio-stub` residual: cada `task` sobe e derruba
a própria base sem deixar processo para trás.

## Base persistente no ar (para as sondas)

Controlador Node dedicado (script em `/tmp/.../scratchpad/subir-persistente.mjs`, chama
`subir({construir:false})` de `base/scripts/ambiente.mjs`), servidor de controle HTTP em
`127.0.0.1:39998` (loopback, só meu). `REDIS_URL=redis://default:dev-shell-escrita@127.0.0.1:6379`,
`REDIS_URL_ZONA=redis://zona:dev-zona-leitura@127.0.0.1:6379` (mesmos valores de
`task verificar:redis`). PIDs: shell 187268, zona1 187269, zona2 187271, acesso 187273; domínios
dominio-a 187108, dominio-b 187109, dominio-c 187110, plataforma 187111, gestao-acesso-v2 187112.
Portas 3000-3003, 4001-4004, 4020 ocupadas por mim.

## Etapa 2 — forja de sessão sem senha (o que uma zona ou domínio falso realmente tem)

### 2.1 — `/proc/<pid>/environ` de toda a árvore (zonas e domínios), confirmando K4-3/K4-4

Zona-1: raiz `pnpm` (187269), filho `sh -c next start` (187477), neto `next-server` (187481) —
**nenhum nível tem `REDIS_URL`**; todos têm só `REDIS_URL_ZONA` (leitura). Os 5 domínios falsos
(187108-187112): **nenhuma variável `REDIS_URL*` em nenhum deles** (K4-4 corrigiu o achado não
bloqueante que o challenger_b1_d1_7 tinha registrado — `subirDominio` agora recebe `envDoDominio`,
sem `REDIS_URL`/`REDIS_URL_ZONA`). Shell (187268): tem `REDIS_URL` com a senha nova e
`REDIS_URL_ZONA`, como esperado.

### 2.2 — Tentativa de forja **só com o que a zona/domínio realmente têm** (script rodado dentro de
`erp-zona-1`, mesmo `node_modules`, nenhum pacote novo instalado), com `process.env.REDIS_URL`
confirmado `undefined`:

```
process.env.REDIS_URL (deve ser undefined): undefined
process.env.REDIS_URL_ZONA (deve existir, so leitura): redis://zona:dev-zona-leitura@127.0.0.1:6379

--- anonimo-sem-senha (redis://127.0.0.1:6379) ---           # o que um dominio falso tem: nada
  CONEXAO/AUTH falhou: NOAUTH HELLO must be called with the client already authenticated...

--- so-REDIS_URL_ZONA-da-zona (redis://zona:dev-zona-leitura@127.0.0.1:6379) ---
  conectou (handshake TCP ok)
  GET antes: null
  SET recusado (esperado): NOPERM User zona has no permissions to run the 'set' command
  DEL recusado (esperado): NOPERM User zona has no permissions to run the 'del' command

--- chute-senha:admin/redis/password/dev/zona/123456 (redis://default:<chute>@127.0.0.1:6379) ---
  CONEXAO/AUTH falhou: WRONGPASS invalid username-password pair or user is disabled.   (as 6 tentativas)
```

**A forja falhou em todas as combinações que a zona ou um domínio falso realmente têm no ambiente**:
sem nenhuma credencial → `NOAUTH` antes mesmo do `HELLO`; com a credencial real de leitura da
zona → `NOPERM` em `SET`/`DEL`; com 6 chutes de senha fraca comum para o usuário `default` →
`WRONGPASS`. Diferente da iteração 7 (onde `SET` sem nenhuma credencial tinha sucesso), aqui
**nenhuma tentativa gravou nada**.

### 2.3 — `ACL LIST` (com a senha correta, só para inspeção — não é credencial que a zona tem)
```
user default on sanitize-payload #81cf66e1... ~* &* +@all
user zona    on sanitize-payload #d866796e... ~erp:sessao:* resetchannels -@all +get +@connection
```
**Nenhum usuário `nopass`**; os dois têm hash de senha (`#...`). Fecha o achado bloqueante da
iteração 7.

### 2.4 — Chave forjada: nada para apagar

Como nenhum `SET` teve sucesso (seção 2.2), não há chave forjada gravada.
`EXISTS erp:sessao:forjada-it8-sem-permissao` → `0`; `KEYS erp:sessao:*forjad*` → vazio. Não
precisei de `DEL`.

### 2.5 — "Arquivos que o processo lê" (o outro vetor do despacho)

`erp-zona-1` é um submódulo git próprio (`repos/erp-zona-1`), sem `docker-compose.yml` nem
`Taskfile.yml` dentro dele — esses arquivos (onde a senha padrão de dev `dev-shell-escrita` está
em texto claro) pertencem só ao repositório principal, fora da árvore que o processo da zona lê no
curso normal. `grep -rn REDIS repos/erp-zona-1` (fora de `node_modules`) só encontra
`lib/redis.ts`, que usa exclusivamente `REDIS_URL_ZONA`. **Ressalva, não achado bloqueante**: como
o processo da zona roda no mesmo host e usuário do sistema operacional que o resto do repositório
(sem sandbox de SO), código arbitrário executando dentro do processo da zona (pré-condição: já ter
RCE ali) tecnicamente conseguiria ler `../../../Taskfile.yml` por caminho relativo e encontrar o
valor padrão `dev-shell-escrita` em texto claro — mas essa pré-condição (RCE dentro do processo)
já dá acesso a muito mais que o Redis (ex.: ler `REDIS_URL_ZONA` do próprio ambiente, atacar outras
zonas no mesmo host), e o padrão é idêntico ao já aceito para `ERP_REDIS_SENHA_ZONA` (senha de
desenvolvimento, documentada como tal em `docs/CONFIGURACAO.md`, nunca pretendida como segredo de
produção). Não testei a leitura de fato (não executei código dentro do processo da zona via RCE
real; apenas verifiquei por inspeção que o arquivo está fora do submódulo) — registrado como
observação, não como achado, e não bloqueia o gate.

## Etapa 3 — V3, V5, If-Match, 401/404/403, Origin, revogação

Nenhum código de produto relevante a estes pontos mudou entre a iteração 7 (que já reconfirmou V3
com rebuild real e mutação ponta a ponta) e agora — o diff `66e3ba8` só tocou Redis/domínios/XN09.
Não redespachei a mutação de V3 (repetir o rebuild não traria achado novo); confirmei que a regra
estática continua ativa (parte da baseline 100/100 acima: `V3 (K4, auditor_b1_d1_4)` e `XN09`
passam) e fiz o resto comportamentalmente, com a base persistente e chamadas reais (não mock).

### Domínio direto — 401/404/403 e composição no servidor
```
sem Authorization              -> 401 {"codigo":"SESSAO_EXPIRADA"}
Authorization: Bearer invalido -> 401 {"codigo":"SESSAO_EXPIRADA"}
Origin: localhost:3000, sem Auth -> 403 {"codigo":"OPERACAO_NAO_PERMITIDA"}
Origin: evil.com, sem Auth       -> 403 {"codigo":"OPERACAO_NAO_PERMITIDA"}
```
**OK**: recusa sem credencial e com credencial inválida; corpo normalizado, sem stacktrace, sem
nome de classe; qualquer `Origin` de navegador é recusado antes de olhar a credencial.

### If-Match (invariante 6) — `concluirTarefa` real (zona2, t-2), via `acaoPeloCliente`
```
ANTES:                  t-2 versao 1, "concluída": false
versao=99 (inventada)   -> HTTP 200, DEPOIS: sem mudança (form ainda mostra versao=1, nao concluida)
sem campo versao        -> HTTP 200, DEPOIS: sem mudança
versao=1 (a certa)      -> HTTP 200, DEPOIS: "concluída": true
```
**OK**: só a versão correta muta o estado.

### CSRF / invariante 5 — Origin de outro site em `concluirTarefa` (mesma t-2, já concluída)
```
Origin=http://evil.example -> HTTP 500, sem cookie __Host-flash, DEPOIS: continua "concluída" (sem novo efeito)
```
**OK**: recusa antes de tocar o núcleo.

### 404 uniforme (invariante 7) — carla em `/zona1/recursos/r-3` × id inexistente
```
status r-3 = 404, status r-999-nao-existe = 404
CSP idêntica exceto o nonce (esperado, muda a cada requisição)
```
Primeira comparação normalizando só `nonce="..."` (atributo HTML) deu **corpos diferentes**;
investigando o diff, a única diferença era um **segundo formato do mesmo nonce**, embutido como
`\"nonce\":\"...\"` dentro do payload RSC serializado (o link de CSS e o script recebem o nonce da
CSP também ali, não só como atributo HTML) — não é o segmento de rota, nem qualquer outro dado
variável. Normalizando os dois formatos, os corpos ficam **byte a byte idênticos** (`diff` vazio).
Isto é uma nota de metodologia (registrar para o próximo challenger não repetir o falso-alarme),
não um achado: a página de erro genuinamente não distingue "fora do escopo" de "não existe".
Não fiz a medição de tempo n≥500 (mesma razão do challenger_b1_d1_6/_7: não há mudança de código
no caminho de 404 desde a iteração 4 que justifique o custo; continua em aberto).

### Perfil administrativo (carla) em `/zona1/recursos/r-1` — sem `custo`
```
status 200, /custo/i? false, /CC-\d/? false
```
**OK**.

### Revogação sem novo login (D7), com formulário real de `/acesso`
```
davi /zona1 ANTES                                -> 200; menu tem /zona1? true
revogarAcesso (carla, ac-09/p-20/zona1)          -> HTTP 200
davi /zona1 DEPOIS (mesma sessao, sem novo login) -> 404; menu tem /zona1? false
concederAcesso (restaurar, p-20/zona1)            -> HTTP 200
davi /zona1 restaurado                            -> 200
```
**OK**: o módulo some já na próxima requisição, sem novo login.

### Varredura de bundle estático e HTML (invariantes 1 e 11)
```
grep -rlE "127\.0\.0\.1:40[0-9][0-9]|redis://" repos/erp-*/.next/static/  -> 0 arquivos
HTML de /zona1 (bruno): accessToken/access_token/refresh_token? false; 127.0.0.1:40? false; redis://? false
```
**OK**, nenhum vazamento.

## Limpeza — concluída

1. Controlador próprio (`subir-persistente.mjs`) recebeu `/derrubar`: derrubou shell, as 4 apps e
   os 5 domínios, e o próprio processo do controlador saiu em seguida.
2. Nenhuma mutação de código foi aplicada nesta rodada (não redespachei o rebuild de V3 — nenhum
   código de produto mudou desde a prova ponta a ponta da iteração 7); não há nada para reverter em
   `repos/erp-zona-1` nem em nenhum outro submódulo.
3. Nenhuma chave forjada foi gravada no Redis (todas as tentativas de `SET` falharam — seção 2.2);
   `EXISTS`/`KEYS` confirmaram isso antes da limpeza. As mutações de estado do domínio-stub feitas
   nas sondas (t-2 concluída em zona2; revogação/concessão de davi em zona1) são só em memória
   (sem `DADOS_DIR`) e sumiram com o processo ao derrubar; `repos/erp-dominio-stub/dados/` não foi
   tocado (`git status` confirma).
4. Portas 3000-3003, 3012, 4001-4004, 4010, 4020 e a de controle 39998: todas **livres**
   (`echo > /dev/tcp`), nenhum `next-server`/`erp-dominio-stub`/`erp-shell`/`erp-zona-*` residual
   (`ps aux`). Verdaccio (4873), `erp-showcase-redis-1` (6379), `erp-showcase-keycloak-1` (8080):
   intocados, continuam no ar como estavam antes de eu começar (não recriei nem derrubei nenhum).
5. `git status` do principal e dos 8 submódulos, conferido no fim: **idêntico ao estado inicial**
   — só os dois `pnpm-lock.yaml` (`erp-dominio-stub`, `erp-moldura`) com o diff de hash local já
   presente antes de eu começar (ignorado por instrução do despacho). `erp-zona-1` e os demais
   submódulos sem diff algum. Untracked: `.agents/challenger_b1_d1_8/` (este handoff) e
   `.agents/reviewer_b1_d1_8/` (processo paralelo, não meu). Nada commitado, instalado nem enviado.

**Portas liberadas: sim. O auditor pode começar.**

## Não executado / lacunas de execução

- **Timing estatístico n≥500 do 404** (existente-fora-de-escopo × inexistente): não fazia parte
  do despacho desta iteração; nenhuma mudança de código no caminho de 404 desde a iteração 4
  justificaria o custo de repetir. Continua em aberto desde a iteração 4 (registrado lá e nas
  iterações 6/7, não como "passou").
- **Rebuild real com a mutação de V3** (`extra={envio.resumo}` com tipo objeto): não redespachei.
  A iteração 7 já provou ponta a ponta (rebuild real, não só automatizado) que o analisador barra a
  mutação e que, sem ele, o `CC-10` vazaria; nenhum código relevante a essa regra mudou desde então
  (o diff `66e3ba8` só tocou Redis, domínios e a regra nova XN09). Confirmei só que a regra
  estática continua ativa na suíte (100/100).
- **Parâmetro `..` do registro de destinos por HTTP puro** (isolado do roteamento de URL do Next):
  mesma lacuna registrada pela iteração 7 — não redespachei porque nada mudou em
  `erp-nucleo/src/interno/destinos.ts` nesta rodada. `//evil.com` e byte de controle continuam sem
  reteste nesta iteração especificamente (ficam validados desde a it7, sem mudança de código no
  caminho).
- **Redis fora do ar / rede lenta entre BFF e domínio**: não simulei — fora do escopo do despacho
  (V1 de novo, V3/V5/If-Match/401-404-403/Origin/revogação) e o Redis é do showcase, compartilhado,
  não é meu para derrubar ou reiniciar.
- **Medição 1 (concorrência de renovação de refresh token no Keycloak)**: fora de escopo (D2, ainda
  não iniciado; núcleo continua 0.9.2, sem OIDC/PKCE).
- **Leitura de fato do `Taskfile.yml`/`docker-compose.yml` a partir de código executando dentro do
  processo da zona (RCE simulado)**: não executei essa prova (exigiria simular uma pré-condição de
  execução de código arbitrário dentro do processo da zona, que já está fora do modelo de ameaça
  "zona com o ambiente e ACL que ela recebe" do despacho); registrei só como observação por
  inspeção de arquivo na seção 2.5, não como achado testado comportamentalmente.
- **Segunda instância de Redis "do zero"** (recriado por mim): não recriei o Redis do showcase (a
  instrução do despacho proíbe explicitamente); testei só contra a instância já recriada com senha
  antes desta rodada, a mesma que `task verificar:redis`/`task verificar` usam.
- **Auditoria linha a linha completa do diff `66e3ba8`** fora do que o despacho pedia: não
  conferi, por exemplo, se `ERP_REDIS_SENHA_SHELL` teria algum outro uso não documentado fora dos
  arquivos já lidos (`Taskfile.yml`, `docker-compose.yml`, `subir.mjs`, `docs/CONFIGURACAO.md`).

## Veredito: **APPROVE**

O achado bloqueante da iteração 7 (usuário `default` do Redis do showcase em `nopass`, escrita
anônima sem nenhuma credencial) **está corrigido e resistiu a esta rodada de sondas**:

- `ACL LIST` (com a senha correta, só para inspeção): nenhum usuário `nopass`; `default` e `zona`
  têm hash de senha.
- Reproduzi a classe exata de ataque da iteração 7 — forjar sessão da `carla` usando **só o que a
  zona ou um domínio falso realmente têm** (confirmado por `/proc/<pid>/environ` em toda a árvore
  de processos: nenhuma zona e nenhum domínio falso tem `REDIS_URL`) — e ela **falhou em todas as
  variações**: sem nenhuma credencial (`NOAUTH` antes do `HELLO`), com a credencial real de leitura
  da zona (`NOPERM` em `SET`/`DEL`), e com 6 chutes de senha fraca comum (`WRONGPASS`). Nenhuma
  chave forjada foi gravada; não houve nada para apagar.
- **Achado não bloqueante da iteração 7 também fechado**: os 5 domínios falsos não recebem mais
  nenhuma variável `REDIS_URL*` no ambiente (confirmado em `/proc/<pid>/environ` dos 5 processos).
- V3, V5, If-Match (invariante 6), 401/404/403 (invariante 7), Origin/CSRF (invariante 5) e
  revogação sem novo login (D7) **sustentam**, todos com evidência bruta de chamada real (não só
  suíte automatizada) nesta rodada.
- `task verificar:redis` 100/100 (2x) e `task verificar` 96+4 pulados (2x), como esperado.

**Ressalva registrada, não bloqueante** (seção 2.5): a senha padrão de desenvolvimento
(`dev-shell-escrita`) está em texto claro em `Taskfile.yml`/`docker-compose.yml`, fora do
submódulo da zona, mas no mesmo host/usuário de sistema operacional — um processo de zona já
comprometido por execução de código arbitrária (pré-condição que já concede muito mais que acesso
ao Redis) poderia lê-la por caminho relativo. Isto é estruturalmente idêntico ao padrão já aceito
para `ERP_REDIS_SENHA_ZONA` (senha de desenvolvimento documentada, não pretendida como segredo de
produção) e está fora do modelo de ameaça que este despacho testou ("o que a zona tem no ambiente
e na ACL"); não testei essa leitura de fato (não simulei RCE dentro do processo da zona). Não
reprova pelo critério A2 nesta rodada, mas vale registrar em `DEFERRED.md` ou `docs/CONFIGURACAO.md`
que a senha de dev do showcase, como a de `zona`, não é segredo de produção — o bloqueio de saída
de rede das zonas no deploy (P1, já citado em D14) é o que fecha essa classe de ameaça de vez.
