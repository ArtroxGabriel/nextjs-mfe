# Gate "Shell novo" (Gabriel) — iteração 3 — reviewer_shell_3

**Veredito: APPROVE**

Escopo revisado: `erp-shell` `git diff 4255635 72e0475` (commits `6d93f8e`, `72e0475`), `erp-zona-1`
`f26fd7c`, `erp-zona-2` `8627c02`, `erp-zona-acesso` `ee623ab`, núcleo `e624c0c` (0.6.0, camada
`borda/`), `base/verificacao/base.test.mjs`, `navegador.mjs`, `saida-de-rede.mjs`,
`base/scripts/ambiente.mjs` (`precisaConstruir`), `base/scripts/verificar-lockstep.mjs`.

Testes executados por mim, todos verdes:
- Núcleo: `./node_modules/.bin/tsc -p tsconfig.json` limpo; `node scripts/fronteira.mjs` → ok;
  `node --conditions react-server --test test/*.test.mjs` → **98/98**.
- Shell: `node --test test/*.test.mjs` → **36/36**.
- `node --test base/verificacao/saida-de-rede.test.mjs base/scripts/*.test.mjs` → **16/16**.
- `node --test base/verificacao/navegador.test.mjs` → **4/4** (Chrome real disponível nesta
  máquina; testei a limpeza de verdade, ver achado de confirmação abaixo).
- Não rodei `base/verificacao/base.test.mjs` (ponta a ponta): usa as portas 3000–3003/4001–4010,
  reservadas ao challenger nesta rodada (confirmei com `ss -ltn` que estão livres agora, mas seguí
  a instrução de não usá-las de qualquer forma). Toda verificação relativa a essa suíte abaixo é
  por leitura de código, mais uma prova ativa própria: mutei `borda/trace.ts` numa cópia local
  (import ilegal de `interno/erros.js`), rodei `node scripts/fronteira.mjs` e confirmei que ele
  reprova (`borda/ nao pode importar interno/`); restaurei o arquivo e revalidei `git status`
  limpo em `repos/erp-nucleo`.

---

## Achados anteriores → resolvido?

| Achado | Resolvido? | Evidência |
|---|---|---|
| reviewer_shell_2 achado 1 — `__Host-flash` removido sem `Secure` no `proxy.ts` do shell | **Sim** | `repos/erp-shell/proxy.ts:52` agora usa `{ path: '/', secure: true, sameSite: 'lax', maxAge: 0 }`, idêntico ao `criarProxy` do núcleo. Teste `L5` em `base.test.mjs:494` afirma `Secure` no `Set-Cookie` de remoção em `/` e `/zona1` — leitura confirma que o teste cobre exatamente o cenário do achado (ainda não executei ao vivo, portas reservadas, mas a asserção do teste bate byte a byte com o código). |
| reviewer_shell_2 achado 2 — `id` de zona com maiúscula reabre o C1 (bypass de sonda) | **Sim** | `repos/erp-shell/lib/zonas.ts:42` — `carregarZonas` agora recusa qualquer `id` fora de `[a-z0-9][a-z0-9-]*` na carga (falha no boot, não na requisição). Confirmei com o teste real (`test/zonas.test.mjs`, rodado por mim): `carregarZonas({ ZonaA: ... })`, `zona_a`, `zona a`, `zona/a`, `-zona`, `''` todos lançam; `zona-a2` é aceito. `zonas.json` real só tem `zona1`/`zona2`/`acesso`, coerente com a regra. |
| reviewer_shell_2 achado 3 — 400 de telemetria não-JSON sem teste | **Sim** | `base.test.mjs:452` (`L4/V2`) manda `post(bruno, 'isto nao e json')` com sessão válida e cookie, espera `400` e confirma `lotesNoColetor.length === 0` — exatamente o par (status + efeito colateral) que faltava. Li o código de `route.ts:31` e o teste bate com a ordem de checagens (sessão → limite → JSON → repasse). |
| auditor_shell_2 V1 — fail-open só testado na zona 1; zona 2/acesso/shell descobertos verdes com fail-open | **Sim** | `base.test.mjs:405-423` (`L1/V1` revisado): `CONTEUDO_DE_MODULO` agora cobre `/zona1`, `/zona1/relatorios`, `/zona2` e `/acesso`, para os quatro usuários (`davi`, `bruno`, `ana`, `carla`), com a gestão de acesso derrubada. Isso é exatamente o G1 que o auditor propôs para fechar o veto. Adicionalmente, há um teste de "dentes" (`base.test.mjs:425`, "L1 tem dentes") que confirma, com a gestão de acesso **no ar**, que quem tem o módulo vê o conteúdo que `CONTEUDO_DE_MODULO` procura — sem isso, um regex errado faria o L1 passar sem provar nada, que era precisamente o defeito que permitiu o V1 escapar antes. Não pude rodar ao vivo (portas reservadas), mas a estrutura do teste fecha a lacuna descrita pelo auditor. |
| auditor_shell_2 lacuna — CSP do shell sem teste (form-action/img-src/object-src/base-uri/frame-ancestors) | **Sim** | `base.test.mjs:537` (`G2`) confere as cinco diretivas e o nonce em `/` (com cookie) e `/login` (sem cookie). CSP do shell agora vem de `politicaDeSeguranca` do núcleo (ver abaixo), testada também no núcleo (`trace-e-csp.test.mjs`, rodei, 98/98 incluindo esse caso). |
| auditor_shell_2 lacuna — telemetria: 429 repassando o lote recusado (T4b2), corpo não-JSON repassado (T4c) | **Sim** | `L4/V2` (`base.test.mjs:441-469`): laço de 61 POSTs, o 61º dá `429` e `lotesNoColetor.length === 60` (o recusado não é repassado); o não-JSON já citado acima também não repassa. |
| auditor_shell_2 lacuna — sonda sem teste de timeout, status ≥ 500, asset só depois da sonda | **Sim** | Unidade nova em `test/saude.test.mjs` (`U1`–`U4`, rodei, verdes): TTL expira nos dois sentidos, `status: 502` conta como fora, `307` conta como no ar, zona travada dá "fora" em <1s com `TIMEOUT_PROBE_PADRAO_MS === 500` testado por nome. `test/proxy.test.mjs` `U5` (rodei, verde) confirma que a sonda roda **antes** do corte de asset estático. `base.test.mjs` `G5` (linha 548) repete isso ao vivo com a zona 2 derrubada de verdade. |
| auditor_shell_2 lacuna — N8 contornável por 7 de 9 formas indiretas; `saude-zonas.ts` só passava por causa da forma do código | **Sim** | `saida-de-rede.mjs` reescrito com o compilador TypeScript (lê a árvore sintática, não texto). `saida-de-rede.test.mjs` (rodei, 16/16) cobre as 9 formas que o auditor listou: `Reflect.get(globalThis,'fetch')`, `import('node:http')` dinâmico, `fetch.call`/valor passado, `const { fetch: f } = globalThis`, `globalThis['fe'+'tch']` (chave calculada), `fetch\`x\``, módulos `node:https`/`undici`, `XMLHttpRequest`. Também há um teste que confirma que a exceção declarada (`saude-zonas.ts`) **ainda dispara** o analisador sem a exceção — ou seja, a exceção não é morta/desnecessária. Confirmei por leitura que `urlSaude` (o alvo do `fetch` de `saude-zonas.ts`) só vem de `zonas.json` ou de variável de ambiente fixa, nunca da requisição — a exceção do AGENTS.md (invariante 4, segunda exceção) é justa. |
| auditor_shell_2 lacuna — `/api/otel`/`/api/auth` casados por prefixo textual (ex.: `/api/otelx` sem cookie) | **Sim** | `lib/decisao-proxy.ts:32` — nova função `noSegmento` exige `caminho === prefixo || caminho.startsWith(prefixo + '/')`. Testes `U6` (`test/proxy.test.mjs`, rodei, verde) confirmam `/api/otelx`, `/api/authx`, `/api/auth-falso/x` continuam exigindo cookie. |

Nenhum achado anterior reaberto por regressão nas suítes que rodei.

---

## Achados novos

Nenhum achado bloqueante ou não-bloqueante confirmado nesta rodada. Pontos que investiguei e
descartei, para registro:

- **Caso do `noSegmento` para `/API/AUTH` (maiúsculas)**: como o `caminho` não é normalizado antes
  de `noSegmento` (diferente de `encontrarZonaPorCaminho`, que faz `toLowerCase()`), uma
  requisição `/API/AUTH` cairia no ramo 4 (rota do shell) e exigiria cookie, em vez de ser tratada
  como pública. Isso é mais restritivo, não mais permissivo — não é a classe de bypass do C1
  (que abria acesso sem sonda a uma zona morta): aqui não há zona nem rewrite de origem envolvidos,
  `/api/auth`/`/api/otel` são rotas do próprio processo do shell. Não encontrei um caminho que
  torne isso um vazamento ou bypass de autorização; é no máximo uma rejeição estranha de uma URL
  com caixa incomum, que nenhum cliente real geraria (não é uma suspeita reportável, apenas uma
  hipótese que testei e descartei — confirmação adicional exigiria simular a requisição real, que
  não fiz por não precisar de porta para isso, mas não achei necessidade dado que não há
  consequência de segurança demonstrável).
- **`x-erp-caminho` sem teste dedicado (M20, "quase equivalente")**: continua sem teste específico
  em `base.test.mjs` ou nas unidades — mas isso já era um achado não-bloqueante do
  `auditor_shell_2` (categoria "quase equivalente", não listado nas lacunas que motivaram o veto)
  e não regrediu nesta rodada. Não o reporto como achado novo, só registro que continua aberto,
  categoria 6 (sem verificação), caso o próximo agente de testes queira fechá-lo.
- **Trace, `borda/` e cliente CDP** (pontos que a orientação pediu atenção extra): confirmei que
  (a) `garantirTraceparent`/`filhoDe` só produzem hex aleatório via `crypto.getRandomValues`, a
  regex W3C rejeita texto forjado e trace/span zerados, e o teste do núcleo afirma explicitamente
  a ausência de identidade (`ana`, `dev.`) no cabeçalho de saída; (b) `borda/csp.ts` e
  `borda/trace.ts` não têm segredo nenhum (só uma string de CSP e geração de hex), e o próprio
  `fronteira.mjs` do núcleo recusa `server-only` dentro de `borda/` e recusa `borda/` importando
  `interno/` — validei essa segunda regra ativamente (mutação isolada, revertida, ver acima);
  (c) o cliente CDP (`navegador.mjs`) limpa processo e perfil de verdade — confirmei com um teste
  que roda o Chrome de verdade (`navegador.test.mjs`, 4/4) e que checa, depois de fechar, que não
  existe processo vivo com o caminho do perfil (`pgrep -f`) e que o diretório do perfil foi
  apagado; (d) o teste "L1 tem dentes" evita exatamente a categoria de teste vazio que motivou o
  veto do auditor na iteração anterior.

---

## O que não consegui executar

- `base/verificacao/base.test.mjs` (ponta a ponta) ao vivo: portas 3000–3003/4001–4010 reservadas
  ao challenger desta rodada. Toda a tabela acima relativa a essa suíte é por leitura de código,
  reforçada por execução das suítes de unidade equivalentes (núcleo 98/98, shell 36/36, N8/lockstep
  16/16, navegador 4/4) e por uma prova ativa isolada da regra de fronteira do núcleo.
- Não testei liberação de `carregarZonas` para unicode case-folding (ex.: `İ` turco) nem se algum
  ambiente real já roda com `id` misto — mesma ressalva que `reviewer_shell_2` registrou, ainda
  não fechada, mas não é um achado novo (é uma lacuna já conhecida e de baixo risco, dado que
  `zonas.json` do repositório é totalmente controlado e a checagem já bloqueia o boot para
  qualquer caractere fora de `[a-z0-9-]`, o que já cobre a classe de ataque relevante — um `id`
  malicioso viria de configuração, não de requisição).

## Housekeeping

Nenhuma porta usada. Nenhum arquivo editado fora de `.agents/reviewer_shell_3/` (a mutação de
`borda/trace.ts` foi feita e revertida na mesma sessão de comandos, com `git status --short`
limpo confirmado logo depois em `repos/erp-nucleo`, `repos/erp-shell` e no repositório principal).
Nenhum pacote instalado.
