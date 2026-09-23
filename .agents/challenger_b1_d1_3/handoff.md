# handoff — challenger_b1_d1_3

Iniciado: 2026-09-22

## Escopo lido
AGENTS.md, LEIA-PRIMEIRO.md, AMBIENTE.md, GATE_STATUS.md (iteração 2, vetos V1-V8), ADR-0014 (+ adendo 1), CONFIGURACAO.md, RETOMADA.md.

## (parcial) Baseline
- `task verificar:redis`: **71/71 verde** (comando `node --test base/verificacao/*.test.mjs` com REDIS_URL/REDIS_URL_ZONA do Taskfile). Bate com o esperado.
- `CONSTRUIR=1 task verificar:construir`: **70 pass + 1 skipped** ("V1 dinamico... # so no modo Redis"). Bate com o esperado (70 + 1 pulado com arquivo).

## (parcial) Base persistente no ar
Controlador Node dedicado em /tmp (base/scripts/ambiente.mjs `subir()`), REDIS_URL/REDIS_URL_ZONA como no Taskfile. Portas 3000-3003, 4001-4004, 4010(sob demanda), 4020.

## (parcial) Família 1 — adversário, resultados até agora
- Cookie forjado em qualquer zona (direto na 3001 e via shell): sempre 307 -> /login, sem conteúdo. OK.
- `curl` direto ao stub 4020 sem Authorization: `401 {"codigo":"SESSAO_EXPIRADA"}`, sem detalhe. OK.
- Granularidade ana/bruno/carla/davi em `/ /zona1 /zona1/relatorios /zona1/recursos/r-1 /zona2 /acesso`: bate exatamente com adendo 1 (ana sem relatorios, tem zona2; bruno tem relatorios, sem zona2; carla sem zona2/relatorios mas com /acesso; davi só zona1 básico). Nenhum vazamento de CPF/papel/custo nos 404 (grep confirmou só o segmento da URL, não conteúdo real).
- RSC real (navegador headless, `window.next.router.push`): davi->/zona1/relatorios (404, sem "Relatórios"), carla->/zona1/recursos/r-1 (sem "custo"), bruno->/zona2 (404). OK, evidência com pedidos `?_rsc=` confirmados.
- Carla não se concede módulo: BFF nega (`administra` check) e, testado direto no domínio com `Bearer dev.carla`, `403 OPERACAO_NAO_PERMITIDA` (segregação real, não só UI).
- Bruno não executa ações da zona de acesso: `acaoPeloCliente concederAcesso` como bruno -> toast de erro, sem mudança de estado (confirmado consultando `/v2/eu` de bruno no domínio depois: sem zona2). **Achado menor**: a mensagem de negação da camada BFF (`motivo==='modulo'`) e a mensagem de recusa do domínio (`OPERACAO_NAO_PERMITIDA`) são texto idêntico (`MENSAGENS.OPERACAO_NAO_PERMITIDA`), então a resposta HTTP sozinha não permite distinguir qual camada barrou (ver bloco de achados).
- acesso v2 fora (4020 derrubada): página de módulo devolve HTML com `<h1>Serviço indisponível</h1>`, menu vazio, sem stacktrace; testado com ana. v1 (4010) subida em paralelo NUNCA é consultada (não há fallback) — confirmado pois a página continuou "indisponível" mesmo com v1 no ar e respondendo.
- Desligamento direto na 4020 (`POST /v2/pessoas/p-20/desligamento`, `Bearer dev.carla`, p-20=davi): `204`. Na requisição seguinte, mesma sessão, sem novo login: davi cai para `307 -> /login` em `/zona1` e em `/`. OK.

## (parcial) Redis V1
- SET/DEL/KEYS/CONFIG GET/EVAL/FLUSHALL com usuário `zona` (REDIS_URL_ZONA do Taskfile): todos `NOPERM` do próprio Redis. GET funciona. OK.
- Redis fora: **NÃO EXECUTADO**. Redis (6379) é compartilhado, subido antes da minha rodada, fora do meu raio de alcance para derrubar. Registrado como lacuna de execução, não como "passou".

## (parcial) Sonda de saúde
- Zona travada (SIGSTOP via `congelarApp`): shell devolve `503` em **0,51 s** (< 2s, dentro do ERP_SONDA_TIMEOUT_MS=500 + folga). OK.
- Zona respondendo `404` em `/zona1/api/health` (zona real derrubada com SIGKILL via `derrubarApp`, substituída por servidor Node mínimo na mesma porta 3001 respondendo 404): shell devolve `503` em `/zona1`. OK.
- Mesmo teste com `307`: shell devolve `503`. OK.
- Zona-1 real restaurada depois (`pnpm start` fora do controlador de ambiente, PID à parte anotado para derrubar na limpeza) e confirmada voltando a `200` para `ana`.

## (parcial) Cabeçalhos e bundle
- CSP com nonce (`'nonce-...' 'strict-dynamic'`) em `/` e `/login` (com e sem sessão). OK.
- Cookie `__Host-session`: `Path=/; Secure; HttpOnly; SameSite=lax`, sem `Domain` — formato `__Host-` correto.
- Varredura de `repos/*/.next/static` (as 4 apps): nenhuma ocorrência de `access_token`, `refresh_token`, segredo do Keycloak (`dev-erp-shell-segredo`), senha do Redis (`dev-zona-leitura`) ou `NEXT_PUBLIC_*` sensível. OK.

## (parcial) Outras sondas
- Registro de destinos / parâmetro hostil: `/zona1/recursos/<id hostil>` com `../../etc/passwd`, `//evil.com`, byte nulo -> `404` limpo (nenhuma chamada externa visível); `..` puro é normalizado pelo próprio roteador do Next para `/zona1` (308) antes de chegar ao código da app.
- Fuzzing de erro: corpo malformado em Server Action -> `404` (`x-nextjs-action-not-found`, sem stack); rota inexistente -> `404` limpo. Varredura de todo HTML/RSC coletado nesta rodada: nenhuma ocorrência de `org.springframework`, `at java.`, `SELECT ... FROM`, `X-Powered-By`, `TypeError:`/`ReferenceError:` cru, `node_modules/`.
- Concorrência (`If-Match`): `concluirTarefa` (zona2, ana, dominio-c) com versão errada (99 contra real 1) -> nenhuma mudança de estado (`t-1` seguiu `versao:1, concluida:false`), toast normalizado "Este registro mudou enquanto você trabalhava nele...". Com versão correta (1) -> sucesso, estado avançou para `versao:2, concluida:true`. POST direto no domínio sem If-Match (`{}`) com credencial de serviço -> `403 OPERACAO_NAO_PERMITIDA` (não consegui isolar se é especificamente por falta de If-Match ou por falta de usuário atuante; não interpreto além do que a resposta mostra).

## Limpeza — concluída
1. PID 681196 (wrapper) e 681251 (next-server filho) da zona-1 restaurada manualmente: mortos com `kill`/`kill -9`.
2. Controlador (base/scripts/ambiente.mjs `subir()`) recebeu SIGTERM: derrubou domínios e apps.
3. Portas 3000-3003, 4001-4004, 4010, 4020 confirmadas livres (`curl` = sem conexão em todas).
4. Verdaccio (4873) intocado e no ar; nenhum processo residual `next-server`/`erp-dominio-stub`.
5. Dados do domínio stub eram só em memória (sem `DADOS_DIR`): desligamento de davi e conclusão de t-1 não persistiram em arquivo, sumiram com o processo.
6. `git status` do principal e dos 8 submódulos: só os dois lockfiles (`erp-dominio-stub`, `erp-moldura`) com diff de hash local, exatamente como avisado no início ("não mexa" — eu não toquei). Nenhuma outra alteração. `.agents/challenger_b1_d1_3/` é o handoff deste próprio agente.

## Veredito: **APPROVE**

Nenhum achado adversário bloqueante nesta rodada. Um achado menor (não bloqueante) documentado abaixo.
Todos os itens pedidos foram executados, exceto "Redis fora" (fora do raio de alcance: Redis é compartilhado).

### Achados

**M1 (menor, não bloqueante) — mensagem de negação idêntica entre camada BFF e domínio.**
`acaoProtegida` do núcleo, ao negar por `motivo==='modulo'` (ver `repos/erp-moldura/src/servidor.ts`), usa
`MENSAGENS.OPERACAO_NAO_PERMITIDA` — o **mesmo texto** que o domínio devolve quando recusa por regra de
negócio (`403 OPERACAO_NAO_PERMITIDA`, ex.: segregação em `POST /v2/acessos`). Testei bruno chamando
`concederAcesso` sem papel administrativo: resposta HTTP idêntica (200, toast "Você não pode executar
esta operação.") tanto se o BFF barrou antes de chamar o domínio quanto se o domínio barrasse depois.
Confirmei por evidência indireta (estado do domínio inalterado, `/v2/eu` de bruno sem `zona2` antes e
depois) que nenhuma concessão ocorreu, mas não consegui, só pela resposta HTTP, provar em qual camada a
negação aconteceu. Não é um vazamento nem uma falha de autorização — ambas as camadas bloqueiam — mas
reduz a capacidade de auditoria/observabilidade de distinguir "a UI nunca deveria ter deixado tentar" de
"o domínio pegou uma tentativa que a UI deixou passar". Sugestão para o revisor/auditor: cobrir com um
teste que espione a chamada de rede ao domínio (como já existe em `base/verificacao` para outros casos)
para garantir que `acaoProtegida` nega **antes** de qualquer chamada a `nucleo.destino(...)`.

### Evidência bruta por sonda

Ver blocos "(parcial)" acima, cada um com comando executado e saída observada. Resumo:
- 71/71 (Redis) e 70+1 pulado (arquivo) na ponta a ponta — bate com o esperado.
- Cookie forjado: sempre `307 → /login`, em qualquer zona, direto ou via shell.
- `curl` sem `Authorization` no stub: `401 {"codigo":"SESSAO_EXPIRADA"}`.
- Granularidade ana/bruno/carla/davi × 6 páginas: bate exatamente com o adendo 1 do ADR-0014.
- RSC real (navegador headless): sem vazamento de conteúdo restrito, CPF, papel ou custo.
- Carla não se concede módulo (barrado pelo BFF e, testado direto, pelo domínio com `403`).
- Bruno não executa ações da zona de acesso (ver achado M1).
- Acesso v2 fora: `200` com "Serviço indisponível", menu vazio, sem stacktrace; v1 nunca é chamada mesmo com a 4010 no ar.
- Desligamento direto na 4020 (`Bearer dev.carla`, p-20=davi): `204`; próxima requisição de davi, mesma sessão: `307 → /login`.
- Redis usuário `zona`: `SET/DEL/KEYS/CONFIG/EVAL/FLUSHALL` = `NOPERM`; `GET` funciona.
- Redis fora: **não executado** (fora do raio de alcance — serviço compartilhado, não posso derrubar).
- Sonda: zona travada (SIGSTOP) → `503` em 0,51 s; zona respondendo `404` ou `307` em `/api/health` (substituída por servidor de teste na mesma porta) → `503` no shell.
- Cabeçalhos: CSP com nonce em toda página; cookie `__Host-session` com `Secure; HttpOnly; SameSite=lax`, sem `Domain`.
- Bundle `.next/static` das 4 apps: nenhuma ocorrência de token, segredo ou `NEXT_PUBLIC_*` sensível.
- Parâmetro hostil em rota (`../../etc/passwd`, `//evil.com`, byte nulo): sempre `404` limpo, sem chamada externa visível.
- Fuzzing de erro: nenhuma string de framework, stacktrace ou SQL em nenhuma resposta coletada.
- Concorrência: versão errada em `If-Match` → sem mudança de estado, toast normalizado; versão correta → sucesso.

### Não executado
- **Redis fora do ar**: Redis (6379) é um serviço compartilhado desta máquina (já estava no ar antes da minha rodada, junto com Keycloak e Verdaccio) e as instruções do gate proíbem derrubar processo que eu não subi. Não simulei essa condição. Fica como lacuna de execução, não como "passou" nem "reprovou".
- **Cold/CSP em navegador real fora do fluxo de teste automatizado dos 3 itens de RSC**: cobri 3 combinações (davi/relatorios, carla/r-1, bruno/zona2) via navegador headless real; não cobri as 16 combinações completas de ator×página em RSC (a suíte `base/verificacao` já cobre isso em L1/L6 com 47+ combinações; não dupliquei tudo por tempo).
- **Distinção de camada exata (BFF vs domínio) na negação de `concederAcesso` por bruno**: ver achado M1; resolvido por evidência indireta (estado inalterado), não por instrumentação direta da chamada de rede.
