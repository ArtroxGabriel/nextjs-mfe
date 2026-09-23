# handoff — challenger_b1_d1_6

Concluído: 2026-09-23.

Gate B1+D1+G3 (acesso v2) + fatias K3/K4, iteração 6. Escopo ec08ed1..HEAD (K3 em 6fd09ad; K4 em 0a2d6c9).
Critério: Decisão A2 (reprova defeito de produto ou erro plausível de boa-fé; contorno deliberado dentro de
D14 não reprova — vira achado sem veto; fora de D14, achado sem veto também, mas registrado).

## Escopo lido
AGENTS.md, .agents/orchestrator/LEIA-PRIMEIRO.md, AMBIENTE.md, RETOMADA.md, GATE_STATUS.md (iterações 4 e 5),
DEFERRED.md (D14), .agents/challenger_b1_d1_4/handoff.md, .agents/auditor_b1_d1_4/handoff.md,
.agents/auditor_b1_d1_4/mutacoes.txt (achados V1-V5 e L1-L5), diff `git show 6fd09ad` e `git show 0a2d6c9`
(código de `base/verificacao/seguranca-estatica.mjs` e `saida-de-rede.mjs`).

## Estado inicial do repositório (antes de eu tocar em qualquer coisa)
- `git status` no principal: só `repos/erp-dominio-stub` e `repos/erp-moldura` com `pnpm-lock.yaml`
  modificado (hash local do Verdaccio, armadilha conhecida em AMBIENTE.md §1). Não toquei nesses dois.
- Untracked: `.agents/reviewer_b1_d1_6/` (agente paralelo, não meu).
- Portas 3000-3003, 3012, 4001-4004, 4010, 4020: todas **livres** antes de eu subir qualquer coisa
  (checagem `echo > /dev/tcp/127.0.0.1/<porta>`, todas recusaram). Nenhum processo `next-server`,
  `erp-dominio-stub`, `erp-shell`, `erp-zona-*` no `ps aux`.
- No ar, não são meus, não toco: Verdaccio (4873), `erp-showcase-redis-1` (6379),
  `erp-showcase-keycloak-1` (8080).

## Baseline (task verificar:redis / verificar:construir)

### ACHADO BLOQUEANTE — V1 (inv. 15) NÃO está corrigido no runtime: REDIS_URL ainda vai para as zonas

`task verificar:redis` (primeira execução, base subida e derrubada pela própria task):
```
ℹ tests 98
ℹ pass 96
ℹ fail 2
```
As duas falhas são exatamente os testes que a K3 escreveu para provar o fechamento do V1
(auditor_b1_d1_4):
```
✖ V1 (auditor_b1_d1_3): zona com REDIS_URL e sem REDIS_URL_ZONA nao le sessao nem conecta como o shell
  AssertionError: a zona sem REDIS_URL_ZONA respondeu 307   (esperado >=500)

✖ V1 (E01f): REDIS_URL de escrita do shell nao esta presente no ambiente das zonas
  AssertionError: erp-zona-1: processo contem REDIS_URL de escrita em /proc/<pid>/environ
```

Causa raiz lida no código (`base/scripts/ambiente.mjs`): existe uma função `envDaApp(dir)` que
apaga `REDIS_URL` do ambiente da zona (linhas ~122-129) — é a correção documentada em K3/RETOMADA
para V1. Só que a função que efetivamente sobe o processo, `iniciar`, tem assinatura de só 3
parâmetros:
```js
const iniciar = (cmd, args, cwd) => {
  const p = spawn(cmd, args, { cwd, env, stdio: log ? 'inherit' : 'ignore', detached: true })
  ...
}
```
e os dois pontos de chamada que deveriam usar o ambiente filtrado passam um 4º argumento que o
JavaScript aceita silenciosamente e descarta:
```
base/scripts/ambiente.mjs:133:  apps.set(dir, iniciar('pnpm', ['start'], join(RAIZ, dir), envDaApp(dir)))
base/scripts/ambiente.mjs:169:  for (const { dir } of APPS) apps.set(dir, iniciar('pnpm', ['start'], join(RAIZ, dir), envDaApp(dir)))
```
`iniciar` sempre usa a variável `env` fechada no escopo externo (que tem `REDIS_URL`, porque
`task verificar:redis` a define no ambiente do processo pai) — nunca o 4º argumento. Ou seja: a
zona sobe hoje com `REDIS_URL` de escrita no `/proc/<pid>/environ`, exatamente o cenário que o
auditor_b1_d1_4 vetou (V1) e que a fatia K3 alega ter fechado.

Isto é um **erro plausível de boa-fé** (assinatura de função não atualizada quando o parâmetro
novo foi introduzido nos call sites) — não é um contorno deliberado de analisador, não cabe em
nenhuma classe do D14. **Reprova pelo critério A2.**

Confirmação independente do teste automatizado, com a base subida por mim e lida direto:
(ver "Família 1 / V1" abaixo — exploração completa, com escrita real no Redis e login como
`carla` sem credencial nenhuma).

## Base persistente no ar (para as sondas adversárias)

Controlador Node dedicado (script próprio em `/tmp/.../scratchpad/subir-persistente.mjs`, chama
`subir({construir:false})` de `base/scripts/ambiente.mjs`), com servidor de controle HTTP em
`127.0.0.1:39998` (loopback, só meu) para `derrubarApp`/`congelarApp`/`subirDominio`/
`derrubarDominio` sem derrubar tudo entre sondas. `REDIS_URL=redis://127.0.0.1:6379`,
`REDIS_URL_ZONA=redis://zona:dev-zona-leitura@127.0.0.1:6379` (mesmos valores de
`task verificar:redis`). PIDs: shell 137709, zona1 137710, zona2 137712, acesso 137714.
Portas 3000-3003, 4001-4004, 4020 ocupadas por mim.

## Família 1 — adversário

### V3 (inv. 2) — mutação de boa-fé (`extra={envio.resumo}`, tipo objeto): analisador pega, sem ele vaza

Mutação exatamente como pedida no despacho: `erp-zona-1/app/zona1/BotaoDeAviso.tsx` ganhou uma prop
`extra?: unknown` (renderizada em `data-extra`), e `page.tsx` passou
`const envio = { resumo: recursos[0]?.custo }; ... extra={envio.resumo}` (tipo de `custo` é
`{ valor: number; centro: string } | undefined`, objeto — exatamente o padrão do veto V3 do
auditor_b1_d1_4, só que com o nome `resumo`, fora da lista fixa `CAMPOS_COMPLEXOS`).

1. `task verificar:estatica` com a mutação em disco:
```
✖ as quatro aplicacoes reais passam 100% nas regras estaticas de seguranca
  erp-zona-1/app/zona1/page.tsx:33 [P0-dto-sensivel] valor nao projetado na prop 'extra' da ilha <BotaoDeAviso>
```
Reprova — bate com o que o K4 (verificador de tipos) promete: decide pelo tipo, não pelo nome do campo.

2. Sem o analisador (build real, rodando o código mutado): reconstruí só `erp-zona-1`
   (`pnpm build`), subi a app e pedi `/zona1` pelo shell como `bruno`:
```
$ curl -H "Cookie: __Host-session=<sessão de bruno>" http://localhost:3000/zona1
data-extra="{&quot;valor&quot;:1200,&quot;centro&quot;:&quot;CC-10&quot;}"
```
**O HTML vazou o centro de custo (`CC-10`) para bruno**, que não deveria ver esse campo — confirma
que, sem o analisador K4, o defeito de boa-fé chegaria a produção.

3. Reverti a mutação (`git checkout -- app/zona1/page.tsx app/zona1/BotaoDeAviso.tsx`), reconstruí
   e subi de novo: `/zona1` como bruno voltou a `200` sem `CC-10` nem `data-extra` no HTML
   (0 ocorrências, checado por `grep -c`).

**Veredito: V3 sustentado. Achado não bloqueante, é a confirmação positiva de que a correção K4
funciona no cenário exato que o despacho pediu.**

### V1 (inv. 15) — EXPLORADO: credencial de escrita do shell vaza para as 3 zonas, sessão forjada aceita

Confirmação direta do ambiente do processo (não só o teste automatizado):
```
$ tr '\0' '\n' < /proc/137710/environ | grep -i redis   # erp-zona-1
REDIS_URL=redis://127.0.0.1:6379
REDIS_URL_ZONA=redis://zona:dev-zona-leitura@127.0.0.1:6379
```
(o mesmo em zona2 137712 e acesso 137714; e no shell 137709, que é quem deveria tê-la).

PoC completo — script rodado dentro do diretório de `erp-zona-1` (mesmo `node_modules`, pacote
`redis` já instalado ali, nenhum pacote novo instalado), usando **só** a `REDIS_URL` que o
processo da zona de fato tem no ambiente, simulando o que qualquer código executando dentro do
processo da zona (dependência comprometida, SSRF, script de depuração) poderia fazer:
```js
const c = createClient({ url: 'redis://127.0.0.1:6379' }) // exatamente a REDIS_URL da zona
await c.connect()
await c.set('erp:sessao:' + sha256('forjada-challenger-b1-d1-6'),
  JSON.stringify({ sub: 'carla', nome: 'Carla (forjada)', accessToken: 'dev.carla', expiraEm: Date.now()+300000 }),
  { PX: 300000 })
```
Saída:
```
ANTES existia? null
GRAVOU chave erp:sessao:ae5fd3218cabb7c4a0ffb486f2db93a6fc80bb60c2e1f1ae0442a1829aafbbbf
DEPOIS {"sub":"carla","nome":"Carla (forjada pelo challenger)","accessToken":"dev.carla","expiraEm":1790201475441}
```
Uso do cookie forjado no shell (o único endpoint que um navegador alcança):
```
$ curl -i -H "Cookie: __Host-session=forjada-challenger-b1-d1-6" http://localhost:3000/
HTTP/1.1 200 OK
... "Olá, Carla (forjada pelo challenger)" ... módulos: Início, Zona 1, Gestão de acesso ...

$ curl -o /dev/null -w "%{http_code}\n" -H "Cookie: __Host-session=forjada-challenger-b1-d1-6" http://localhost:3000/acesso
200   # Gestão de acesso, módulo administrativo, sem NENHUMA credencial real

$ curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/   # controle, sem cookie
307
```
Chave forjada apagada depois (`DEL` -> 1, `EXISTS` -> 0), confirmado.

**Isto é um achado adversário bloqueante, binário**: a mitigação declarada para V1 (auditor_b1_d1_4,
K3/RETOMADA) não está em vigor no processo real. Qualquer coisa capaz de rodar JavaScript dentro
do processo de qualquer zona (não precisa nem ser código malicioso no sentido de "escrito para
isso" — um erro de dependência, um `eval` de config, uma SSRF que alcança `redis://127.0.0.1:6379`
sem senha) autentica como qualquer usuário, inclusive o papel de gestão de acesso. A causa (bug de
plumbing em `iniciar()`, `AMBIENTE.md`/código) já está documentada acima. Repetido 1x (a escrita e
o login foram feitos uma vez cada, determinístico — o teste automatizado já reproduziu 2/2 antes
disso).

### Cookie forjado sem sessão real no Redis, direto na porta da zona (bypassando o shell)
```
curl -H "Cookie: __Host-session=nao-existe-no-redis-1234" http://127.0.0.1:3001/zona1  -> 307
curl -H "Cookie: __Host-session=nao-existe-no-redis-1234" http://localhost:3000/zona1  -> 307
```
**OK**: sem uma chave real no Redis (camada 2), o cookie sozinho (camada 1) nunca autoriza — nem
direto na porta da zona, nem pelo shell.

### Domínio direto sem Authorization / com Authorization inválido
```
curl http://127.0.0.1:4001/v1/recursos                                  -> 401 {"codigo":"SESSAO_EXPIRADA"}
curl -H "Authorization: Bearer lixo-invalido" http://127.0.0.1:4001/v1/recursos -> 401 {"codigo":"SESSAO_EXPIRADA"}
```
**OK**: recusa sem credencial e com credencial inválida; corpo normalizado (`{codigo}`), sem
stacktrace, sem `SELECT`, sem nome de classe.

### If-Match (invariante 6) — `concluirTarefa` (zona2, t-2, versão real 1)
Via `acaoPeloCliente` (mesmo caminho de um navegador com JS: `Next-Action` + `encodeReply`),
conferindo o **estado real no domínio** antes/depois de cada tentativa (não só o HTTP da action,
que em Server Actions do Next é sempre 200 mesmo quando o toast é de erro):
```
ANTES:        t-2 { concluida: false, versao: 1 }
versao=99 (inventada) -> HTTP 200, estado DEPOIS: { concluida: false, versao: 1 }  (nao mudou)
sem campo versao      -> HTTP 200, estado DEPOIS: { concluida: false, versao: 1 }  (nao mudou)
versao=1 (a certa)    -> HTTP 200, estado DEPOIS: { concluida: true,  versao: 2 }  (mudou)
```
**OK**: só a versão correta muta o estado; versão velha e ausência de versão são recusadas pelo
domínio sem efeito (`ifMatch` montado em `erp-zona-2/app/zona2/acoes.ts:15` a partir do campo do
formulário).

### 404 uniforme para recurso fora de escopo (invariante 7)
```
carla /zona1/recursos/r-3 (fora do escopo dela) -> 404
```
Bate com o que o challenger_b1_d1_4 já tinha medido (corpo idêntico a id inexistente, byte a byte,
neutralizando só o nonce da CSP). Não repeti a medição de tempo (n=15 na iteração 4, já registrada
como indicativa, não como prova estatística) — não há achado novo aqui para justificar gastar mais
tempo de execução nisso nesta rodada.

### Revogação de sessão/acesso — D7 do ADR-0009, sem novo login
Carla revoga o acesso de davi a `zona1` (Server Action real, `acaoPeloCliente`); **mesma sessão**
de davi, sem novo login:
```
davi /zona1 (ANTES da revogacao)              -> 200
revogarAcesso (carla)                          -> HTTP 200
davi /zona1 (mesma sessao, SEM novo login)    -> 404
davi / : menu contem "/zona1"?                -> false
concederAcesso (restaurar, carla)              -> HTTP 200
davi /zona1 (restaurado)                       -> 200
```
**OK**: o módulo some já na próxima requisição, sem precisar de novo login — D7 sustentado.
Restaurado ao estado original ao final.

### Varredura de bundle estático e HTML por endereço interno e token (invariantes 1 e 11/V5)
```
grep -rlE "127\.0\.0\.1:40[0-9][0-9]|redis://" erp-*/.next/static/  -> vazio (nada achado)
grep -oE "accessToken|access_token|refresh_token" no HTML de /zona1 (bruno)  -> vazio
```
**OK**, nas 4 apps: nenhum endereço interno de domínio/Redis nos bundles servidos ao navegador, e
nenhum token no HTML capturado.

## Limpeza — concluída

1. Controlador próprio (`subir-persistente.mjs`, servidor de controle em `127.0.0.1:39998`)
   recebeu `/derrubar`: derrubou o shell, as 4 apps rastreadas por ele e os 5 domínios.
2. A zona-1 tinha sido reiniciada **fora** do controlador duas vezes (uma com a mutação do V3, uma
   já limpa) para poder reconstruir só ela sem afetar o resto da base; nenhuma das duas ficou no
   `Map` de processos do controlador, então precisei matá-las à mão (`kill -9` no PID do
   `next-server`, confirmado pela porta 3001 com `ss -tlnp`) depois do `/derrubar`. Confirmado:
   porta 3001 livre e nenhum processo `next-server` remanescente.
3. Chave forjada do PoC de V1 (`erp:sessao:ae5fd3218cabb7c4a0ffb486f2db93a6fc80bb60c2e1f1ae0442a1829aafbbbf`)
   apagada (`DEL` -> 1, depois `EXISTS` -> 0, e `KEYS *forjad*` vazio no fim). Não fiz `FLUSHALL`
   nem apaguei outras chaves: as ~176 `erp:sessao:*` restantes são sessões normais dos meus próprios
   `entrar()` desta rodada, com TTL, igual ao padrão registrado pelos challengers anteriores.
4. Mutações de código revertidas e conferidas: `erp-zona-1/app/zona1/page.tsx` e
   `erp-zona-1/app/zona1/BotaoDeAviso.tsx` voltaram ao original (`git checkout --`), reconstruídos
   (`pnpm build`) e a versão limpa foi a última a rodar e a ser derrubada. `git diff --stat` depois
   do checkout: vazio.
5. `git status` do principal e dos 8 submódulos, conferido no fim: só os dois `pnpm-lock.yaml`
   (`erp-dominio-stub`, `erp-moldura`) com diff de hash local — **os mesmos que já estavam assim
   antes de eu começar**, não toquei neles. `erp-zona-1` sem diff nenhum. `.agents/challenger_b1_d1_6/`
   é este handoff; `.agents/reviewer_b1_d1_6/` é processo concorrente, não meu. Nada commitado,
   instalado nem enviado.
6. Dados do domínio stub: só em memória (sem `DADOS_DIR`) — tudo que mutei (t-1 concluída, t-2
   concluída, revogação/concessão de davi em zona1) sumiu com o processo ao derrubar o controlador;
   nenhum arquivo em `repos/erp-dominio-stub/dados/` foi tocado.
7. Portas 3000-3003, 3012, 4001-4004, 4010, 4020 (e as de controle 39998/39999): todas **livres**,
   conferido por `echo > /dev/tcp` e por `ps aux` (nenhum `next-server`/`erp-dominio-stub`/
   `erp-shell`/`erp-zona-*` residual). Verdaccio (4873), `erp-showcase-redis-1` (6379),
   `erp-showcase-keycloak-1` (8080): intocados, continuam como estavam antes de eu começar.

**Portas liberadas: sim. O auditor pode começar.**

## Não executado / lacunas de execução

- **Não redespachei os itens de "Perfil administrativo / centro de custo com carla" e "404 r-3 vs
  r-9 com timing n≥500"**: já estavam validados com evidência bruta pelo challenger_b1_d1_4 na
  iteração 4 (nenhum código de produto relevante a esses dois pontos mudou entre a iteração 4 e
  agora — só `base/verificacao/*`, `Taskfile.yml`, `base/scripts/ambiente.mjs` e
  `base/showcase/medicao-refresh-concorrente.*` mudaram no diff `ec08ed1..HEAD`). Repetir teria
  gasto tempo de execução sem achado novo possível; se o gate quiser a prova estatística formal de
  n≥500 para o timing do 404, ela continua em aberto (registrada como tal desde a iteração 4).
- **Redis fora do ar**: não é meu para derrubar (serviço compartilhado do showcase, já estava no ar
  antes da minha rodada). Não simulei essa condição. Fica como lacuna, não como "passou".
- **Medição 1 (concorrência de renovação de refresh token no Keycloak)**: não redespachei — é D2
  (ainda não iniciado nesta base; núcleo continua 0.9.2, sem OIDC/PKCE). Fora do escopo K3/K4 desta
  iteração.
- **`base/showcase/medicao-refresh-concorrente.mjs`** (arquivo novo no diff `ec08ed1..HEAD`): não
  executei. É referente à Decisão C do humano (D2), fora do escopo desta rodada (K3/K4), e exige o
  Keycloak configurado para o fluxo real de renovação, que a base local ainda não usa (`task
  verificar:redis` roda com `ERP_PERMITIR_IDENTIDADE_DEV=1`, sem OIDC).
- **`Taskfile.yml` e as mudanças em `base/scripts/ambiente.mjs` fora de `envDaApp`/`iniciar`**: não
  fiz uma auditoria linha a linha de tudo que mudou nesses arquivos; concentrei o tempo no que o
  despacho pedia (V1, V3, V5, If-Match, 401/404/403, revogação) e no que a própria baseline
  (`task verificar:redis`) apontou como quebrado. Pode haver outras divergências não descobertas
  nessas mudanças de infraestrutura de teste.
- Não reproduzi o V1 numa segunda janela de tempo/máquina — é determinístico nesta máquina (2/2 no
  teste automatizado + 1/1 no PoC manual), mas não testei se o comportamento muda com
  `CONSTRUIR=tudo` (só rodei com o build já existente e com `CONSTRUIR=1` na primeira
  `task verificar:redis`); não há razão para esperar diferença, já que a causa é o `spawn()` em
  `ambiente.mjs`, não o conteúdo do build.

## Veredito: **REQUEST_CHANGES**

Achado adversário bloqueante e binário: **V1 (invariante 15) não está corrigido no código real**,
apesar de `RETOMADA.md`/`GATE_STATUS.md` (iteração 5) e do despacho desta iteração tratarem V1 como
fechado pela fatia K3. A causa é um erro plausível de boa-fé — `iniciar(cmd, args, cwd)` em
`base/scripts/ambiente.mjs` tem assinatura de 3 parâmetros, mas os dois call sites que precisavam
do ambiente filtrado (`envDaApp(dir)`) passam um 4º argumento que a função nunca lê, então toda
zona sobe com o ambiente completo do processo pai, incluindo `REDIS_URL` (a credencial de escrita
do shell). Isto não é um contorno deliberado de analisador estático (não há analisador nenhum
envolvido: é o processo real, medido via `/proc/<pid>/environ` e explorado com um `set` de verdade
no Redis) — não cabe em nenhuma classe do D14, então não tem o efeito de "vira achado sem veto" da
Decisão A2; é exatamente o tipo de defeito que a A2 manda vetar.

Evidência: a própria `task verificar:redis` reprova 2/98 testes hoje (`base.test.mjs:482` e
`base.test.mjs:909`) — reproduzido determinística e independentemente 2 vezes por mim antes de eu
sequer tentar o PoC manual. O PoC manual confirma o efeito fim-a-fim: com a `REDIS_URL` do ambiente
da zona-1, escrevi uma sessão da `carla` (perfil de gestão de acesso) direto no Redis e o shell a
aceitou como legítima em `/` e em `/acesso`, sem nenhuma credencial real.

Os demais itens do despacho (V3 com o verificador de tipos, V5/endereços internos, If-Match,
401/404/403, revogação sem novo login, cookie forjado sem sessão real) **sustentam** — todos com
evidência bruta acima — e não haveria motivo de reprovação por eles isoladamente. O gate como um
todo reprova pelo V1.

**Correção sugerida** (não implementei: challenger não corrige código de produto/infra de teste):
dar nome aos parâmetros de `iniciar` incluindo o ambiente (`iniciar(cmd, args, cwd, envApp = env)`)
e usar `envApp` no `spawn(...)` em vez da variável `env` fechada no escopo; ou eliminar o parâmetro
solto e fazer os dois call sites chamarem `iniciar(cmd, args, cwd)` só depois de já terem embutido
o ambiente certo. De qualquer forma, os dois testes que hoje falham (`base.test.mjs:482` e `:909`)
são o critério de fechamento — a correção só conta quando eles passarem de verdade com `task
verificar:redis` verde, não só com uma leitura de código.
