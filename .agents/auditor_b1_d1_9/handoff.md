# auditor_b1_d1_9 — handoff

Gate B1+D1+G3+K, iteração 9. Auditor forense com veto (Opus). 2026-09-28. Critério: Decisão A2.
Escopo: K5 (`d9ff04e`), `c4b94e6` (showcase, completude) e `erp-nucleo` `08642ed` (fronteira).

## Veredito: **PASS** (sem veto)

Os quatro vetos da it.8 e as lacunas L1–L4 e L6 agora são pegos por teste, e cada correção reprova quando revertida.
A K5 fecha o V1 também no produto: com a senha de escrita definida, nenhum processo de zona ou domínio a recebe, em nenhuma
fase, e uma zona construída com código que grava no carregamento não grava. Sobraram lacunas de teste e contornos
deliberados. Nenhuma deixa passar defeito de produto nem erro plausível de boa-fé que o código atual cometa.

Registro: `mutacoes.txt` (uma linha por mutação ou contorno, com a evidência; classificação no fim). Logs em `anexos/lote/<id>.log`,
`anexos/lote{U,S,E,E2a,EA}.out`, `anexos/*contornos*.log`, `anexos/prova-senha-shell.log`, `anexos/showcase-subir.log`,
`anexos/e2e-{base,final}-redis.log`, `anexos/e2e-base-arquivo.log`, `anexos/estado-{inicial,final}.txt`. Executor:
`anexos/mut.mjs` + `lote.mjs` (edição por texto exato, restauração byte a byte conferida, dados do stub restaurados a cada
rodada). Lotes gerados por `anexos/gerar-lotes.mjs`.

**Volume:** 60 mutações de unidade (núcleo, stub, shell, scripts), 59 no estático, 27 de ponta a ponta no modo Redis
(9 refeitas) e 15 no modo arquivo, mais 3 no showcase e 2 no registro de ambiente. Foram aplicados 157 contornos nos
analisadores: 117 da it.4, it.3 e it.8, reaplicados nos dois modos (com e sem programa TS), e 40 novos. Somam-se duas provas sem
mutação: a senha de escrita e o showcase real.

## 1. Catálogo da it.8 reaplicado (piso)
- **V1 (inv. 15):** a prova da senha (`anexos/prova-senha-shell.mjs`) subiu a base com `ERP_REDIS_SENHA_SHELL`, `REDIS_URL` e
  `QUALQUER_SEGREDO_NOVO`, todas com a senha real. Pelo `/proc/<pid>/environ`, só o shell tem a senha. As 3 zonas e os
  5 domínios não têm nenhuma das três variáveis. Com toda credencial `redis://` de cada zona a gravação dá
  `NOPERM`, e o cookie forjado recebe 307. **E01g:** a zona 1 foi reconstruída com código que grava no
  carregamento se houver `REDIS_URL`. Deu 109/109, a chave ficou ausente e o cookie recebeu 307: o build não
  recebe mais a credencial. E01e e E01f ficam sem efeito (chave ausente).
- **V2 (N8):** XR20q4 é pego no estático e no ponta a ponta, nos modos Redis e arquivo (107/109 e 103/109), e XR20q/XR20r
  também (47/48). Os contornos XR20c–i, antes sobreviventes, agora são pegos.
- **V3:** SR3 é pego (47/48, teste `V3 (auditor_b1_d1_8, XR38p/SR3)`).
- **V4 (fronteira):** N38g, N38h, N38i, N38k e N38l são pegos, assim como N38b–f. Reverter a regra por tipo (FK15)
  ou a derivação (FK1) reprova.
- **Lacunas pedidas:** L1 (TA1, TA4, TA5, TA9) é pega. L2: SR6 é pego, e SR1, na forma nova (SK3), só falha para o
  lado seguro. L3 (XN09a/b) é pega. L4 (FR2, reaplicado como FR2b) é pega. L6: AMB4 → AK9 e AMB6 → AK8 são pegas nos
  dois modos.
- Sem regressão nos contornos da it.4 e da it.3 (`diff` com os logs da it.8 vazio). S17c (L5, fora do pedido) segue sobrevivendo,
  e SR7 é equivalente.

## 2. Mutações novas sobre a K5
- `ambiente.mjs`: AK1–AK5 são pegas na unidade. No ponta a ponta, AK8 (registrar), AK9 (domínio), AK10 (senha por outro nome),
  AK11 (`subirApp`) e AK6t (build com `CONSTRUIR=tudo`) são pegas nos dois modos. Sobrevivem AK6, AK7 e AE1 (lacunas LA e LB).
- `saida-de-rede.mjs`: SK1, SK2, SK4–SK7 (hoisting largo demais em bloco, `for`, `catch` e propriedade de parâmetro) e SK9–SK11,
  SK16 são pegas. SK3, SK14 e SK15 só geram falso positivo; SK12 e SK13 não compilam ou são equivalentes. Sobrevive SK8 (LE).
- `seguranca-estatica.mjs`: LK1–LK4 (L3) e RK1–RK2 (`raiz`) são pegas.
- `fronteira.mjs`: FK1, FK5–FK10, FK13–FK15 são pegas. N38m (`export * as` com o escritor), N38n (`export *`) e N38o (escritor novo
  em `/shell` por `export *`, tipo com `gravar`) também são pegas. Sobrevivem FK3 e FK4 (LC). FK2, FK11, FK12 e N38p são
  equivalentes hoje.
- `showcase/subir.mjs`: o showcase real sobe no código limpo (o `ping` autenticado da `c4b94e6` funciona) e só o shell recebe a senha.
  SH1–SH3 sobrevivem porque nenhum teste roda o `subir.mjs` (LG).

## 3. Suspeita do revisor (arquivo novo de `fabricas/`/`adaptadores/` gravando sessão sem tipo com `gravar`)
**Confirmada no estático e descartada como defeito de produto.** NR1 cria `fabricas/renovar.ts`, que grava pelo
`ClienteRedisDeLeitura` convertido para ter `set`, e o exporta por `/app`. NR2 cria `adaptadores/sessao-disco.ts`, que
grava com `node:fs`, e o exporta pela raiz. As duas passam na fronteira (142/142). NR3, a forma literal (`import 'redis'`
direto), não compila (TS2307): o núcleo não depende de `redis`.
O que vale no modo Redis: o cliente da zona é um objeto só com `get` (`lib/redis.ts` das zonas) e o usuário ACL `zona`
recebe `NOPERM` no `SET` (teste `base.test.mjs:456` e a prova acima). No modo arquivo a zona já tem `SESSAO_DIR` e `fs`
permitido, com ou sem o núcleo. Esse modo é só de desenvolvimento (D12, `docs/CONFIGURACAO.md`). Fica como lacuna LD.

## 4. Vetos
Nenhum.

## 5. Lacunas sem veto (correção e teste sugeridos)
- **LA — o build só é conferido quando a rodada constrói.** AK6 acrescenta ao `executar` a linha `if (fase === 'build')
  Object.assign(envProc, env)`, sem tocar na linha que o teste estrutural procura. Resultado: unidade 18/18 e
  `task verificar:redis` 109/109, porque com `CONSTRUIR=1` e só `ambiente.mjs` mudado nada é construído. Com
  `CONSTRUIR=tudo` (AK6t) o teste pega. `base/verificacao/base.test.mjs:942` confere o build só "se houve".
  *Correção:* `precisaConstruir` (`ambiente.mjs:38`) considerar também `base/scripts/ambiente.mjs`, ou exportar `executar`
  para um teste de unidade que lance `build` com um comando que despeja o ambiente. *Teste:* AK6 reprova com `CONSTRUIR=1`.
- **LB — `extras` e `ambientesEntregues` são confiados pelo teste.** AK7 (`build` com `extra: env`) sobrevive mesmo com
  `CONSTRUIR=tudo`, nos dois modos: `base.test.mjs:952` ignora as chaves de `extras`. AE1 (o registro em `ambiente.mjs:121`
  guarda outra coisa) sobrevive, e AE1+AK8 também, porque o `registrar` é um processo curto e só o registro o vê.
  *Correção:* `executar` recusar `extra` fora da fase `avulsa`, e o teste não isentar `extras` fora dela; para as fases
  curtas, conferir o ambiente pelo próprio processo (um script que despeja o que recebeu). *Teste:* AK7 e AE1+AK8.
- **LC — a regra por tipo não tem teste nos ramos de união e de `Promise`** (`fronteira.mjs:51-53`). FK3 e FK4 dão 142/142.
  Os ramos pegam hoje N38q (`sessaoAssincrona(): Promise<StoreDeSessao>` na raiz) e N38r
  (`LeitorDeSessao | StoreDeSessao`), mas sem eles os dois passam 142/142. É a mesma classe do TA1 da it.8.
  *Teste:* N38q e N38r como casos da fronteira.
- **LD — a fronteira não vê escrita por cliente ou `fs` sem tipo com `gravar`** (NR1, NR2; §3). *Correção possível:* fora de
  `shell/` e dos dois adaptadores de escrita, proibir chamada de `set`/`del` em valor do tipo `ClienteRedis*` e escrita de
  `node:fs`.
- **LE — `valorConstante` aceita `let` sem que o teste perceba** (SK8, 48/48). O caso `let` do teste
  (`saida-de-rede.test.mjs:189`) é pego por outra regra, a do literal `'fetch'` na reatribuição. *Teste:* `let k =
  'toString'; k = 'fe' + 'tch'; globalThis[k]()` tem de reprovar.
- **LF — L3 residual:** `config.assetPrefix ??= process.env.X` (XN09h), `||=` (XN09i), `+=` (XN09n) e
  `Object.defineProperty(config, 'assetPrefix', …)` (XN09j) passam. A regra de `seguranca-estatica.mjs:465` só olha `=`.
  *Correção:* aceitar todo operador de atribuição e tratar `defineProperty`.
- **LG — o showcase não tem teste** (SH1–SH3). Um exemplo é SH2: `REDIS_URL_ZONA ??= REDIS_URL` entrega a senha às zonas
  pelo nome permitido. Observações: o banner (`subir.mjs:57`) imprime a `REDIS_URL` com a senha de escrita, e a senha
  vai na linha de comando do `docker` do host (`subir.mjs:31`, `-e REDISCLI_AUTH=<senha>`, visível no `ps`). O
  comentário só vale dentro do container. `-e REDISCLI_AUTH`, sem valor, herdaria a variável do ambiente do `execFileSync`.
- Completude (`ambiente.test.mjs`, não é segurança porque a lista falha fechada): `process.env?.X`, `process['env'].X`,
  `const { X } = process['env']`, `const { X = {} } = process.env` e o apelido `const e = process.env` não são vistos.

## 6. Contornos novos (deliberados; registrar em D14 ou corrigir)
- `declare const|let|function|class fetch/WebSocket` esconde a global: XR20k2–k5, XR20l e XR20m, com `analisar() = []`.
  A declaração só existe no tipo, e o código compilado usa a global. *Correção de uma linha:* `nomesDasInstrucoes`
  (`saida-de-rede.mjs:86`) ignorar nós com o modificador `declare`.
- `require` por apelido, `require.call`, `__non_webpack_require__`, `module.require` e `process.mainModule.require`
  (XR40–XR44): classe "sintaxe montada" do D14.
- Rede do navegador sem `fetch` (`WebTransport`, `new Image().src`, `new Worker`, `serviceWorker`: XR45–XR48). A defesa que
  vale é a CSP do núcleo (`default-src 'self'`, `img-src 'self' data:`).

## 7. D14 confirmados (sobrevivem, contorno deliberado)
XA09, XA10, XA12, XA13; XP01, XP03–XP06; XN02, XN03, XN04, XN09d, XR28c, XR28d; XL01–XL04; XN08, XR30. Equivalentes e controles:
XA15, XA19, XP11, XS01, XS02, XN07, XR21, XR22, XR25, XR29, XR33, XR34, XR36, XR37, XL05, XU01–XU03, XR20j, XR20z, XN09k.

## 8. Estado final conferido (`anexos/estado-final.txt`)
- As fontes dos 8 submódulos estão nos HEADs do principal, sem diff. Continuam modificados só os `pnpm-lock.yaml` do stub e da
  moldura, iguais byte a byte às cópias do início. O `principal` em `base/`, `repos/`, `Taskfile.yml` e `docs/` é igual
  ao HEAD.
- O `dist` do núcleo nas 4 apps é `9ff2f87f441075e6`, igual ao tarball 0.9.2 do Verdaccio. O `dist` local do núcleo também
  é igual ao tarball (`diff -r` vazio), depois de apagar 12 arquivos órfãos deixados pelas mutações com arquivo novo (armadilha abaixo).
- Os `dados/` do stub são iguais à cópia do início. O showcase real gravou dois `MANIFESTO_REGISTRADO` em
  `dados/estado/gestao-acesso-v2.json` (ignorado pelo git), e restaurei o arquivo da cópia.
- No Redis, as chaves forjadas (`forjada-aud8-build`, `-aud8-e01f`, `-aud9-senha`, `-aud8-senha`, `forjada-anonima`) têm `EXISTS 0`,
  e nenhuma chave `erp:sessao:*` está sem TTL.
- `CONSTRUIR=1 task verificar:redis` no código limpo deu **109/109** (`anexos/e2e-final-redis.log`). A base no modo arquivo deu 105 + 4 pulados.
- As portas 3000–3003, 3012, 4001–4004, 4010, 4020 e 4999 (alvo) estão livres, sem `next-server`, stub ou alvo residual.
  Verdaccio, Redis e Keycloak ficaram intocados: o `docker compose up -d` do showcase só achou os containers `Running`, conferido com `--dry-run` antes.
  Não commitei nem instalei nada.

## 9. Armadilhas para o `AMBIENTE.md`
- **Mutação que cria arquivo no `src/` do núcleo deixa órfão no `dist` local:** o `tsc` do `pnpm test` não apaga o `.js` depois que
  o `.ts` é restaurado. Confira o `dist` com `diff -r` contra o tarball e apague os órfãos.
- **Rodada que estoura o timeout do executor deixa a base de pé** (TF1 de novo, como na it.8), e as rodadas seguintes falham por
  porta ocupada (52/109). Confira as portas depois de toda rodada com `saida null`.
- `*.log` está no `.gitignore`: os logs de `anexos/` só entram no git com `git add -f`.
- O commit parcial `8f0ec61` do orquestrador levou `alvo.pid`, que apaguei ao derrubar o alvo; ele aparece como removido no `git status`.
