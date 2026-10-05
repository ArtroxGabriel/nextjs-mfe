# Revisão Task 3 D19-B — achados (final)

**Veredito:** aprovada com ressalvas. Nenhum Critical; 1 Important (cabe na Task 4).

## Verificação rodada pelo revisor
- `task test`: contratos 20, núcleo 262, moldura 26, stub 75, shell 102, tudo verde.
- `task typecheck` ok; `verificar:estatica` 51/51; `scripts:test` 21/21; `lockstep` ok (0.10.3 em 4 apps).
- Ponta a ponta não rodado (sem portas): reprovação com 0.10.2 e com "não esperar" aceita pela evidência do relatório.

## Shell: cada item e o teste que reprova se ele for revertido
- `Max-Age` de `expiraEm` (`lib/rotas-auth.ts:86`): sim, IdP com 60 s → `Max-Age=60`; env 90 → 90 e o store vive o mesmo.
- `registrarFalha` ligado (`lib/nucleo.ts:47`): sim, mas o teste lê a fonte com regex (Minor). O formato da linha tem teste.
- `server-only` em `lib/cookies.ts:1`: sim, `spawnSync` sem/com `--conditions react-server`. O `proxy.ts` já importava
  módulos `server-only` (`lib/nucleo.ts`), então o build não muda.
- `lerHostsDoShell()` com `trim`: sim, unidade + `sair` com espaço + leitura da fonte das duas rotas.
- Comentário D19 (`lib/decisao-proxy.ts:46-62`): confere com o desenho; sem teste por natureza, o comportamento está em
  `proxy-renovacao.test.mjs` (prontas = 0 até liberar o IdP).

## Important
1. **`SHELL_HOSTS` com `trim` só no shell.** As zonas continuam com `.split(',')` cru em `erp-zona-1/lib/pagina.ts:16`,
   `erp-zona-2/lib/pagina.ts:16`, `erp-zona-acesso/lib/pagina.ts:16` e nos 3 `next.config.ts:9` (`allowedOrigins`). A
   variável é a mesma para as apps (`CONFIGURACAO.md:44`). Se a Task 4 documentar "SHELL_HOSTS aceita espaço" (como o
   relatório sugere), um `a, b` passa no shell e as Server Actions das zonas vindas de `b` são recusadas (fail-closed:
   disponibilidade, não segurança). Correção: aplicar o mesmo `split/trim/filter` nas zonas (pagina.ts e next.config.ts),
   de preferência um helper só; ou, no mínimo, a Task 4 documentar que só o shell aceita espaço e registrar o resto no
   `DEFERRED.md`.

## Minor
- `base/verificacao/oidc/oidc.test.mjs:283`: a guarda `Date.now() > antes.tokenExpiraEm` não protege a tolerância; use
  `> antes.tokenExpiraEm + TOLERANCIA_S * 1000`, que é o que o comentário promete.
- Tempo do e2e: no `verificar:oidc`, `ERP_RENOVACAO_ESPERA_MS` fica no padrão 2000 e `ERP_DESTINO_TIMEOUT_MS` é 2000
  (`Taskfile.yml:129-132`). Um refresh do Keycloak acima de ~2 s vira 307 nos perdedores (flaky). Opcional: 4000 no task
  (< lock 5000). A espera até o vencimento sai do `tokenExpiraEm` gravado, não de conta fixa: ok.
- `test/rotas-auth.test.mjs` "lib/nucleo.ts passa o registrador": regex `^\s*registrarFalha: registrarNoConsole,$` quebra
  com reformatação; aceitável (mutação pega), mas frágil.
- `test/proxy-renovacao.test.mjs:159`: `prosseguir` vale para `em-dia` e `em-andamento`; o teste distingue a espera só
  por `prontas === 0`. Basta, a distinção fina está no núcleo.
- `entrar`: `Math.max(0, …)` dá `Max-Age=0` (apaga o cookie) se `expiraEm` já passou; caso degenerado, ok.

## Esquema no `sair` (`lib/rotas-auth.ts:39-50`)
- Confirmado: `Sec-Fetch-Site` presente decide sozinho (linha 41); a comparação de esquema só roda sem ele.
- O protocolo de `req.url` no Next 16 já vem de `X-Forwarded-Proto` (`next/dist/server/next-server.js:1278-1280`,
  `base-server.js:607-611`): atrás de proxy TLS que manda `X-Forwarded-Proto: https`, `req.url` é `https://…` e passa.
  Só quebra se o proxy não mandar o cabeçalho **e** o navegador não mandar `Sec-Fetch-Site`.
- Confiar em `X-Forwarded-Proto` aqui: forjá-lo só muda a checagem da própria requisição de quem forja. O atacante de
  CSRF não define cabeçalhos no navegador da vítima, e um cliente fora do navegador já forja `Origin`. Não é destino de
  rede (o veto do `01-operacao.md:99` é sobre origem de destino), então não abre SSRF.
- **Recomendação:** manter como está (`req.url`), sem variável nova. Na Task 4, documentar em `CONFIGURACAO.md`/infra que
  o proxy que termina TLS deve definir (sobrescrevendo) `X-Forwarded-Proto`; sem ele, só navegador sem `Sec-Fetch-Site`
  leva 403 no sair. Não usar `IDP_URL_RETORNO` como origem pública (só existe no modo OIDC).

## Lockfiles
- Seguem o `AMBIENTE.md` §1: mudança de dependência de verdade, aviso no commit ("this machine's Verdaccio hash; elsewhere
  publish 0.10.3 and run task pacotes:alinhar-hashes"), diff só de versão e integrity (10 linhas), igual às 0.10.2
  (`e171df8`, `42df5ea`, `7bf1cce`, `75f8234`). Em outra máquina: publicar o núcleo de `fdea296` (ponteiro do principal
  confere) e `alinhar-hashes`; nada além do documentado.

## Núcleo 0.10.3
- `void Promise.resolve(r).catch(...)` (`criarNucleo.ts:217`): correto. Adota thenable não nativo, rejeição e `then` que
  lança; valor comum não aciona o catch. O teste do thenable reprova com o `instanceof Promise` (mutação do relatório).

## Invariantes
- 1: o registrador só escreve etapa/motivo, código e supportId. 3: `server-only` em cookies, rotas-auth e nucleo.
  10: `sair` continua só da mesma origem. 12: o 403 é `{ codigo, supportId }`. 15: renovação e sessão só no shell/núcleo.
  Nenhuma violação.
