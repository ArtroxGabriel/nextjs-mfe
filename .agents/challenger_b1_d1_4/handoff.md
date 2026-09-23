# handoff — challenger_b1_d1_4

Iniciado e concluído: 2026-09-23. Gate B1+D1+G3+K, iteração 4 (correção K2 sobre a iteração 3).

## Escopo lido
AGENTS.md, .agents/orchestrator/LEIA-PRIMEIRO.md, AMBIENTE.md, RETOMADA.md (Fatia K2), GATE_STATUS.md
(iteração 3), .agents/auditor_b1_d1_3/handoff.md + mutacoes.txt, .agents/challenger_b1_d1_3/handoff.md.

## Estado inicial do repositório (antes de eu tocar em qualquer coisa)
- `git status` no principal: só `repos/erp-dominio-stub` e `repos/erp-moldura` com `pnpm-lock.yaml`
  modificado (hash local, armadilha conhecida em AMBIENTE.md §1); untracked `.agents/reviewer_b1_d1_4/`
  (agente paralelo, não meu). Não toquei nesses dois lockfiles.
- Portas 3000-3003, 3012, 4001-4004, 4010, 4020: todas livres antes de eu subir nada.
- Verdaccio (4873), Redis (6379), Keycloak (8080): no ar, não são meus, não toco.

## Baseline
- `task verificar:redis`: **88/88 verde**. Bate com o esperado.
- `CONSTRUIR=1 task verificar:construir`: **85 pass + 3 skipped**. Bate com o esperado.

## Base persistente no ar
Controlador Node dedicado (`base/scripts/ambiente.mjs` `subir()`, `CONSTRUIR=1`), com um servidor de
controle HTTP em `127.0.0.1:39999` (loopback só meu) para pedir `subirDominio`/`derrubarApp`/
`congelarApp`/`subirAppAvulsa` das sondas de degradação, sem derrubar o controlador inteiro entre
sondas. `REDIS_URL=redis://127.0.0.1:6379`, `REDIS_URL_ZONA=redis://zona:dev-zona-leitura@127.0.0.1:6379`
(showcase, ACL só-leitura). Portas 3000-3003, 4001-4004, 4010 (sob demanda), 4020 ocupadas por mim;
3012 reservada para zona avulsa (E01c).

## Família 1 — adversário

### P09/V5 — Origin forjado em `revogarAcesso`/`concederAcesso` (zona1, categoria "direto")
Script: `sonda1c.mjs`. Campos reais lidos do `<form>` renderizado de `/acesso` (carla), via
`acaoPeloCliente` (mesmo caminho de um navegador com JS: `Next-Action` + `encodeReply`).
```
davi em /zona1 (antes): 200
revogarAcesso, Origin=null       -> HTTP 200, davi em /zona1 depois: 200 (nada mudou)
revogarAcesso, Origin=evil.com   -> HTTP 500, davi em /zona1 depois: 200 (nada mudou)
revogarAcesso, Origin=shell      -> HTTP 200, davi em /zona1 depois: 404 (executou de verdade)
concederAcesso, Origin=shell     -> HTTP 200, davi em /zona1 depois: 200 (restaurado)
```
Confirmado com `curl` do corpo da resposta 500 (Origin evil.com): só `{"digest":"..."}`, sem
stacktrace nem nome de classe.
**Nota (não bloqueante):** meu primeiro teste usou `davi`+`zona2` (categoria "validado" no
manifesto v2) e a "contraprova com Origin válido" pareceu falhar (davi continuou 404 em `/zona2`
mesmo com o `POST /v2/acessos` criando o registro no domínio, confirmado por
`curl -H "Authorization: Bearer dev.carla" http://127.0.0.1:4020/v2/acessos`). Não é bug: zona2 é
"validado" — conceder cria acesso **pendente**, que exige segunda validação antes de ficar ativo.
Refiz com `zona1` ("direto") para isolar o comportamento do inv. 5, que é o que P09/V5 testa.
**Veredito: OK, invariante 5 se sustenta** (nenhum estado muda sem `Origin` correto, com campos
reais do formulário renderizado).

### E10c/V4 — CPF, e-mail funcional e `"cpf"` da semente
Scripts: `sonda2-e10c.mjs` (fetch direto, HTML + cabeçalho `rsc:1`), `sonda2b-e10c-navegador.mjs`
(Chrome real via CDP, sessão de `carla`, navegação de cliente entre unidades "Norte"/"Central" em
`/acesso`, 31 respostas de rede coletadas).
```
HTML de /acesso (carla): CPFs=0, e-mails=0, literal 'cpf'=false
RSC de /acesso (carla, rsc:1): CPFs=0, e-mails=0, literal 'cpf'=false
Navegador real, 31 respostas de rede (RSC de navegação de cliente): CPF vazado? false | email vazado? false | literal cpf? false
DOM renderizado (outerHTML após navegação): CPF no DOM? false
```
**Veredito: OK.**

### E01b/E01c/V1 — nenhuma zona usa o usuário `default` do Redis
`docker exec erp-showcase-redis-1 redis-cli` (uso do próprio container já no ar, não instalei nada;
não há `redis-cli` nesta máquina fora do container).
```
CLIENT LIST (antes): 1x user=default (shell, cmd=set) + 3x user=zona (as 3 zonas, cmd=get)
CLIENT KILL USER default -> 1 (matou a conexão do shell)
curl direto nas portas 3001/3002/3003 (sem cookie e com cookie __Host-session forjado) -> 307 em todos
CLIENT LIST depois: 2x user=default (shell reconectou) + 3x user=zona — nenhuma conexão nova de zona
  como default, com ou sem cookie forjado
KEYS erp:sessao:* -> 91 chaves (ruído do próprio teste: cada entrar() das minhas sondas grava uma;
  TTL ~1389s, dentro do esperado); nenhuma com "forjado" no nome (grep vazio)
```
Zona avulsa sem `REDIS_URL_ZONA` (porta 3012, `subirAppAvulsa` com `REDIS_URL` setado e
`REDIS_URL_ZONA: null`): **500 em toda requisição, inclusive sem cookie** (recusa mais cedo que só
"na leitura de sessão" — parece falhar na inicialização do módulo `lib/redis.ts`, não por rota).
Corpo da resposta: `Internal Server Error`, sem detalhe. Nenhuma conexão nova no Redis (nem
`default` nem `zona`) apareceu no `CLIENT LIST` depois de bater nela — ela nunca chega a conectar.
**Veredito: OK, mais estrito que o mínimo pedido** (K2-1 fechado).

### Health `/{zona}/api/health`
```
direto porta 3001 /zona1/api/health -> 200 {"status":"ok"}
direto porta 3002 /zona2/api/health -> 200 {"status":"ok"}
direto porta 3003 /acesso/api/health -> 200 {"status":"ok"}
via shell, sem cookie, /zona1/api/health -> 307 (camada 1 do shell intercepta antes de rotear)
```
**Veredito: OK**, bate com L1(E05)/K2-8 (corpo fixo, público na porta da zona).

### Link de Relatórios (P10/L3) e granularidade
```
davi -> link "Relatorios" no HTML de /zona1? false | /zona1/relatorios direto: 404
bruno -> link "Relatorios" no HTML de /zona1? true  | /zona1/relatorios direto: 200
```
Matriz completa (repete o essencial da iteração 3, `sonda6-granularidade.mjs`):
```
        /     /zona1  /zona1/relatorios  /zona1/recursos/r-1  /zona2  /acesso
ana     200   200     404                200                  200     404
bruno   200   200     200                200                  404     404
carla   200   200     404                200                  404     200
davi    200   200     404                200                  404     404
```
Bate exatamente com o adendo 1 do ADR-0014 e com o observado pelo challenger_b1_d1_3.
**Veredito: OK.**

### Perfil administrativo não concede dado (carla, custo, r-3)
`carla /zona1/recursos/r-1`: status 200, **sem** a palavra "custo"/"Custo" no HTML.
404 de recurso fora de escopo (`r-3`, carla) × 404 de id inexistente (`r-9`, mesmo tamanho de string
para não confundir o path ecoado no payload de hidratação com um sinal real): **corpo idêntico**
depois de neutralizar só o nonce da CSP (que muda a cada requisição, por desenho) — confirmado por
diff byte a byte (`sonda6e.mjs`). Antes de neutralizar o comprimento do próprio segmento de URL
(`r-3` vs `r-inexistente-xyz`, tamanhos diferentes), o HTML tinha bytes a mais: é só o path que o
próprio cliente digitou ecoado no estado interno do App Router para hidratação (`"c":[...,"r-3"]`),
não um sinal sobre existência — o atacante já sabe o que pediu. Timing grosseiro (n=15, não é a
amostra de 500 do desempenho): r-3 27,83 ms de média × r-9 27,49 ms — sem separação visível nessa
amostra pequena; não posso afirmar mais que isso com n=15.
**Veredito: OK, com a ressalva de que a medida de tempo aqui é só indicativa (n=15), não a prova
estatística que o item de desempenho da checklist pediria.**

### If-Match a partir da página (t-1, versão 3)
`GET /v1/tarefas` no domínio direto: `t-1` está na **versão 3** (bate com K2-8/P16). Formulário
renderizado de `/zona2` (ana) trouxe `{ id: 't-1', versao: '3' }` como campo oculto.
```
concluirTarefa com versao='99' (velha) -> HTTP 200 (toast de erro), t-1 continua versao:3, concluida:false
concluirTarefa com versao='3' (a do form) -> HTTP 200, t-1 vira versao:4, concluida:true
```
**Veredito: OK.** (Estado só em memória no stub — some quando eu derrubar a base.)

### v2 fora, v1 no ar em paralelo: sem fallback
Derrubei só `gestao-acesso-v2` (4020) via o controlador; subi `gestao-acesso` v1 (4010) ao lado.
`ana /zona1` com v2 fora: `200`, corpo com "indispon[í]vel" (serviço indisponível), **sem** `cpf` nem
`papel` (o v1 nunca é consultado) e sem stacktrace/framework. Restaurei v2 e derrubei v1 depois.
**Veredito: OK.**

### Desligamento com sessão já aberta, sem novo login
Sessão de `davi` aberta **antes** do desligamento (`/zona1` = 200). `POST /v2/pessoas/p-20/desligamento`
como carla (bearer dev.carla) -> `204`. **Mesma sessão**, requisição seguinte, sem novo login:
`/zona1` -> `307`, `/` -> `307`. (Reiniciei o domínio v2 uma vez no meio do caminho para voltar davi
à semente, porque eu mesmo já tinha desligado ele antes num teste anterior nesta mesma rodada —
registrado para não confundir: o primeiro desligamento também produziu 307 consistente, só que
numa ordem que não isolava "sessão aberta antes" de "login depois de desligado".)
**Veredito: OK.**

## Limpeza — concluída
1. Controlador (`base/scripts/ambiente.mjs` `subir()` + servidor de controle local em 127.0.0.1:39999)
   recebeu `SIGTERM`: derrubou as 4 apps e os domínios (inclusive o `gestao-acesso` v1 que eu tinha
   subido à parte e já tinha derrubado antes do fim).
2. Portas 3000-3003, 3012, 4001-4004, 4010, 4020: todas **livres** (`echo > /dev/tcp` recusado em
   todas), nenhum processo `next-server`/`erp-dominio-stub`/`erp-shell`/`erp-zona-*` residual (`ps aux`).
3. Verdaccio (4873), Redis (6379), Keycloak (8080): continuam no ar, intocados.
4. `CLIENT LIST` do Redis ao final: só a conexão `user=default` do meu próprio `redis-cli` de checagem
   (via `docker exec`); nenhuma conexão de zona nem sobra da base. As ~91 chaves `erp:sessao:*` que
   cheguei a ver no meio da rodada eram sessões normais criadas pelos meus próprios `entrar()` (TTL
   ~23 min, mesmo mecanismo de sempre); nenhuma chave forjada (grep por "forjado" vazio). Não fiz
   `FLUSHALL` nem apaguei chave nenhuma manualmente — é serviço compartilhado, não é meu para limpar,
   e elas expiram sozinhas.
5. Dados do domínio stub: só em memória (sem `DADOS_DIR` no meu ambiente) — tudo que mutei nesta rodada
   (grants/revogações de teste, `t-1` concluída, desligamento/reativação de davi) sumiu com o processo
   ao derrubar o controlador. Nenhum arquivo em `repos/erp-dominio-stub/dados/` foi tocado (é
   `dados/estado/` que seria a pasta de persistência, e ela nem existe: `git check-ignore` confirma que
   é ignorada e o `git status` do submódulo não mostra nada lá).
6. `git status` do principal e dos 8 submódulos, conferido no fim: só os dois `pnpm-lock.yaml`
   (`erp-dominio-stub`, `erp-moldura`) com diff de hash local — **os mesmos que já estavam assim antes
   de eu começar** (registrado no topo deste handoff); não toquei neles. `.agents/challenger_b1_d1_4/`
   é este próprio handoff. `.agents/reviewer_b1_d1_4/` foi commitado pelo reviewer durante a minha rodada
   (`7687ac0`, **APPROVE**) — processo concorrente, não meu.

## Não executado / lacunas de execução
- **Redis fora do ar**: não é meu para derrubar (compartilhado, já estava no ar antes da minha rodada);
  não simulei essa condição, igual ao challenger_b1_d1_3. Fica como lacuna, não como "passou".
- **Timing estatístico com n≥500** para 404 existente×inexistente: fiz só n=15 (grosseiro, sem separação
  visível na amostra pequena); não é a prova de distinguibilidade que uma medição de desempenho formal
  exigiria — registrado como indicativo, não como conclusão.
- Não repeti as 16 combinações completas de ator×página em navegador real (a suíte `base/verificacao`
  já cobre isso em L1/L6 com 47+ combinações, rodada duas vezes por mim como parte da linha de base
  88/88); cobri 1 navegação real de cliente (E10c, carla em `/acesso`) e o resto por `fetch` direto.

## Veredito: **APPROVE**

Nenhum achado adversário bloqueante nesta rodada. Todos os itens pedidos no despacho (1–6) foram
exercitados com a base real no ar, com evidência bruta (comando + saída) acima. A fatia K2 não
regrediu nada do que o challenger_b1_d1_3 tinha achado (granularidade, v2 sem fallback, desligamento
→ login) e fechou de verdade os dois vetos que dependiam de comportamento com a base no ar (P09/V5,
E01b/E01c/V1), com uma margem melhor que o mínimo pedido na zona avulsa sem `REDIS_URL_ZONA` (falha
já na inicialização, não só na leitura de sessão).

Achado menor, não bloqueante, registrado por transparência: minha primeira tentativa de P09/V5 usou
`zona2` (categoria "validado" no manifesto v2), onde `concederAcesso` cria um acesso **pendente**, não
ativo — não é bug, é a segregação de funções do próprio domínio; troquei para `zona1` ("direto") para
isolar o comportamento do invariante 5. Fica registrado caso alguém queira, no futuro, um teste de
"Origin válido + módulo validado fica pendente, não ativo" — hoje não está coberto nem pela suíte nem
por mim, e não bloqueia o gate porque não é o que P09/V5 testa (é regra de negócio do domínio).
