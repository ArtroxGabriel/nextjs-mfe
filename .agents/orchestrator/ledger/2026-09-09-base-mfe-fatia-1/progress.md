# SDD ledger — plan: docs/superpowers/plans/2026-09-09-base-mfe-fatia-1.md

Decisoes de pre-flight (aprovadas pelo humano):
- Instalacoes aprovadas em bloco: next@16, react@19, react-dom@19, typescript@5.6,
  @types/{node,react,react-dom}, server-only@0.0.1, verdaccio via pnpm dlx.
- Rastreabilidade por SUBMODULOS git: cada sub-repo vira submodulo de nextjs-mfe assim
  que tiver o primeiro commit. `repos/` saiu do .gitignore para permitir isso.
  Custo comunicado e aceito: acopla os cinco ao repositorio externo, e o .gitmodules
  aponta para caminhos locais ate existirem remotes.
- Servidores de longa duracao (verdaccio, stub, shell, zona) sao do CONTROLADOR, nao
  dos subagentes: um processo iniciado num dispatch nao sobrevive ao seguinte.

Review packages: gerados DENTRO de cada sub-repo com OUTFILE explicito apontando para
este workspace, porque review-package roda git no diretorio corrente.

AVISO: `git clean -fdx` na raiz destroi `repos/` inteiro. Nao rodar.

Ordem de submodulo: erp-contratos (apos T2), erp-nucleo (T3), erp-dominio-stub (T7),
erp-shell (T8), erp-mfe-pedidos (T9).


Task 1: review 1 — spec OK; 2 Important, ambas plan-mandated (defeitos do plano, nao do
  implementador). Humano consultado conforme a regra: revisor governa nos dois.
  (a) registry.mjs `down` matava o wrapper `pnpm dlx`, nao o grupo — Verdaccio seguia
      ouvindo em :4873 enquanto o script dizia ter derrubado. `up` testado 2x, `down` 0x.
  (b) README afirmava que `repos/` e ignorado — deixou de ser verdade com a decisao de
      submodulos.
Task 1: plano corrigido pelo controlador (commit e2cc71d) — kill de grupo, texto do README
  e um passo de verificacao do `down`, que faltava.
Task 1: fix round 1/5 (2 endereçadas pelo implementador, aguardando re-review; commits
  59bc9d4..d2f44ed)
Task 1: re-review — ambas ADDRESSED (registry.mjs:17-21 kill de grupo com comentario;
  README.md:3-5). Sem breakage novo. `down` agora exercitado: porta para de responder e
  volta com 200.
Task 1: complete (commits db8637a..d2f44ed, review clean)

Task 2: implementador DONE_WITH_CONCERNS. Concern verificada pelo controlador e CONFIRMADA
  num projeto limpo: em Node 24.7, `node --test test/` reporta fail 1, nao executa arquivo
  nenhum e AINDA ASSIM sai com codigo 0 — suite vazia parece verde. Afetava 5 tasks.
  Plano corrigido para `node --test test/*.test.mjs` (commit ededddb).
Task 2: correcao de correctness enviada ao implementador ANTES da review (script test do
  package.json ainda tinha a forma quebrada).
Task 2: submodulo repos/erp-contratos registrado (33496cd, branch master).
  Nota: `git add -A` no repo externo adiciona sub-repos como gitlink solto — desfeito e
  refeito via `git submodule add`. Repetir o cuidado nas tasks 3, 7, 8 e 9.
Task 2: review 1 — spec OK, task quality Approved. 1 Important plan-mandated + 2 warn.
  (a) Important: AcaoPedido e ACOES_PEDIDO eram listas independentes; comentario do plano
      afirmava derivaçao inexistente. Humano: revisor governa, versao endurecida.
      Plano corrigido (7695d94): derivaçao real + test/tipos.test-d.ts verificado por tsc
      + passo que prova que cada @ts-expect-error reprova de verdade.
  (b) warn resolvido pelo controlador: tarball publicado carrega scripts.test antigo.
      RULING: sem republicacao — files:["dist"] nunca empacota test/, e ninguem executa
      script de dependencia. Sem impacto funcional.
  (c) warn resolvido pelo controlador — GAP REAL em tasks futuras: exactOptionalPropertyTypes
      garante a ausencia total no tsconfig de quem CONSOME, e os tsconfig de erp-shell e
      erp-mfe-pedidos nao tinham a flag. Sem ela, uma app poderia atribuir
      condicaoComercial: undefined sem erro. Plano corrigido (bd35744), briefs 8 e 9
      regenerados.
Task 2: fix round 1/5 despachado (derivacao + teste de tipo).
Task 2: BLOCKED no fix round 1 — implementador achou defeito do plano (tsconfig.tipos.json
  herdava rootDir "src" e incluia test/ => TS6059 antes de qualquer checagem semantica;
  noEmit nao evita). Diagnostico correto, recusou-se a contornar. Plano corrigido (c95e3af).
Task 2: fix round 1/5 (1 achado, 4 partes, todas ADDRESSED; commits fc2f689..7fe1a5b).
  Falsificacao confirmada: exactOptionalPropertyTypes=false -> TS2578 na linha 14, saida 2;
  restaurado -> saida 0. Testes de tipo nao sao decorativos.
  NOTA do re-review, vale para o resto do projeto: asserções positivas de tipo NAO provam
  derivaçao — TS e estruturalmente tipado, entao uma uniao escrita a mao com os mesmos
  literais passaria igual. A garantia vem de existir UM unico lugar onde as strings sao
  escritas, nao do teste.
Task 2: complete (commits 4b825dc..7fe1a5b, review clean)

Task 3: NEEDS_CONTEXT antes do Step 1 — dois achados, ambos reais:
  (a) o `test` da Task 3 chamava `pnpm fronteira`, mas scripts/fronteira.mjs so nasce na
      Task 6. Suite nao alcancaria nem RED. Plano corrigido (ee72a27): Task 3 sem fronteira,
      Task 6 ganha um Step 4b que cria o script E o liga ao `test`.
  (b) o brief carregava a forma antiga `node --test test/`. ERRO DE BOOKKEEPING DO
      CONTROLADOR: apos corrigir o plano eu regenerei so os briefs 2, 8 e 9. Os briefs
      3-7, 10 e 11 ficaram obsoletos.
      LICAO: regenerar TODOS os briefs apos qualquer edicao do plano, nao so os "afetados".
      Feito agora para os 11.
Task 3: NEEDS_CONTEXT (2a vez) — dois achados, ambos reais:
  (c) `normalizar` montava o retorno como literal; sob exactOptionalPropertyTypes,
      `body?: T` recusa `T | undefined`. Atalho tentador seria desligar a flag — seria
      ERRADO: e ela que faz `condicaoComercial?` significar chave AUSENTE em vez de chave
      presente valendo undefined, e o invariante 2 depende disso. Flag fica, construçao
      passa a ser por atribuicao.
  (d) o pnpm-workspace.yaml do repo externo capturava `pnpm install` dentro de repos/*:
      dependencias iam para o node_modules de fora, pacote parecia instalado e nao estava.
      Testei 4 opcoes num scratch: `.npmrc ignore-workspace=true` NAO funciona e nao
      avisa. Solucao: pnpm-workspace.yaml com `packages: []` em cada sub-repo.
      Aplicado tambem em erp-contratos pelo controlador (45d04af); reinstalado do zero,
      3/3 passam. Plano corrigido (93a2d62) para os cinco repos.
Task 3: DONE (e76bdb4), 12/12. Implementador sondou resolverDestino com TAB/LF/CR entre
  barras, byte nulo, barra fullwidth, /@evil.com e http:// embutido — sem bypass; o check
  final url.origin !== base.origin segura independente dos guards de prefixo.
Task 3: investigado `minimumReleaseAgeExclude` que apareceu no pnpm-workspace.yaml sem
  estar no brief. NAO e desvio: o proprio pnpm 11 escreve essa linha ao instalar pacote
  recem-publicado (reproduzido em scratch limpo). Documentado no plano; vale para T8 e T9.
  Hook no-ai-authorship barrou o primeiro commit do implementador — funcionando como deve.
Task 3: primeira tentativa de review ABORTADA por limite de sessao da API (429, opus).
  Sem achados — nao houve veredito. Redespachada em sonnet.
  DECISAO DE ORCAMENTO: nao usar opus no resto desta execucao, inclusive na review final
  do branch, salvo se o limite resetar e o humano pedir. Sonnet e o teto daqui pra frente.
Task 3: review (sonnet) — spec OK, task quality NEEDS FIXES. 3 Important, todas
  plan-mandated. IMPLEMENTACAO PAUSADA pelo humano (prioridade virou arquitetura), entao
  o fix loop NAO foi despachado. Achados registrados aqui para nao se perderem:
  (1) supportId passa SEM VALIDACAO do corpo upstream para o erro lançado. E um dos dois
      unicos campos que o modulo deixa atravessar, e seu conteudo nunca e verificado —
      upstream pode por stacktrace/SQL ali. O teste do brief so prova que `message` nao
      vaza. Fix: exigir typeof string + limite de tamanho, senao descartar.
  (2) sem teste de regressao para o allowlist de `codigo` (o unico teste do ramo !res.ok
      nao envia `codigo`, entao nunca exercita a rejeicao de codigo desconhecido).
  (3) sem teste do check load-bearing de origem em resolverDestino. Revisor rederivou:
      o parser WHATWG remove TAB/CR/LF do input INTEIRO antes de parsear, entao '/\t/evil.com'
      vira '//evil.com' e passa pelos guards de prefixo — so `url.origin !== base.origin`
      salva. Se alguem "simplificar" os guards no futuro, a suite fica verde e o SSRF volta.
  Minor: OpcoesUpstream exportado fora da lista de Interfaces; 'DESTINO_INVALIDO' aceito
  vindo do upstream (codigo interno do BFF, o dominio nao deveria poder alega-lo);
  ruido do pnpm na captura de saida de teste.

RETOMADA da implementacao apos a pausa de arquitetura. Desenho fechado em tres documentos
  (00-arquitetura, 01-operacao, 02-zonas), commitado e enviado ao fork.
Task 3: humano deu aval ("continue") para a recomendacao sobre os 3 achados plan-mandated.
  Plano corrigido (8881fc3): sanitizarSupportId com regex opaca que DESCARTA (nao trunca),
  DESTINO_INVALIDO removido dos codigos aceitos do upstream, e os dois testes de regressao
  que faltavam (allowlist de codigo; byte de controle vs check de origem).
Task 3: fix round 1/5 despachado, com exigencia de falsificacao — remover o check de
  origem tem que fazer o teste novo REPROVAR.
Task 3: fix round 1/5 — 3/3 ADDRESSED, sem breakage (commits e76bdb4..106e7fc). 15/15.
  Falsificacao verificada pelo re-review: removendo o check de origem, SO o teste novo
  reprovou (6/7 no arquivo) — prova que ele e especifico, nao redundante.
  DEFERIDO para a review final (nao bloqueia): sanitizarSupportId e allowlist de FORMATO,
  nao de semantica — nome de classe sem pontuacao, blob base64url e hostname interno cabem
  na regex. Desenho mais forte seria o BFF CUNHAR o proprio supportId; nao adotado porque
  mudaria o contrato de C8. Registrado em 00-arquitetura §4.3.
  DEFERIDO: construtores de SessaoInvalida/Desatualizado aceitam supportId sem sanitizar;
  a garantia vive no chamador, nao na classe. Sem bypass vivo hoje.
Task 3: complete (commits 4b825dc..106e7fc, review clean, 2 deferidos)

Task 4: DONE_WITH_CONCERNS (d9eb68c), 19/19. Concern 1 ACEITA e corrigida antes da review:
  dadosFake usava `pedidos[id]` com id vindo da URL — devolve propriedade HERDADA para
  __proto__/constructor/toString, entao o fake divergia de dadosHttp exatamente nos ids
  que um atacante escolhe. Pior que valor errado: fake que nao se comporta como o
  adaptador real destroi o proposito da porta — todo teste escrito contra ele para de
  provar algo sobre producao, em silencio. Plano corrigido para Map (f5608a6) + teste novo.
  Concern 2 (contagem de testes no brief) tambem corrigida: 20, nao 16.
  Hook no-ai-authorship barrou os trailers de novo; confirmado ao implementador que a
  politica do usuario prevalece e nao precisa mais ser sinalizada.
Task 4: review — spec OK, NEEDS FIXES. 3 Important, todas plan-mandated:
  (1) teste de travessia VAZIO: apontava para porta 4000 sem listener, passava por
      ECONNREFUSED. Revisor reproduziu que uma implementacao deliberadamente vulneravel
      (concatenacao crua) reprova identico. E o brief se contradizia: narrava "o stub
      devolvera 404" descrevendo um stub que o teste nunca subia.
  (2) BURACO REAL: encodeURIComponent nao escapa ponto. id='..' vira '/pedidos/..' que a
      normalizacao colapsa para '/' — MESMA ORIGEM, fora do namespace. O elemento 7
      protege a origem e nunca dispara aqui. Meu comentario no codigo NEGAVA isso.
      Fix: rejeitar '.' e '..' com NaoEncontrado (nao erro proprio — erro distinguivel
      viraria oraculo de enumeracao).
  (3) dadosFake NAO era intercambiavel: dadosHttp omite a chave `versao` sem ETag, e o
      fake nunca conseguia omitir porque PedidoDTO.versao e obrigatorio. Segunda instancia
      da mesma classe que o implementador ja tinha achado. Fix: opcoes.omitirVersao.
  Plano corrigido (5db610a). Fix round 1/5 despachado com falsificacao exigida nos dois
  testes novos.
Task 4: fix round 1/5 — 3/3 ADDRESSED (commits ae4cc59..0b5cc43), 22/22. Ambas as
  falsificacoes reprovaram. Re-review provou a completude da guarda ESTRUTURALMENTE:
  encodeURIComponent sempre escapa % para %25, logo a unica string cuja saida vira
  dot-segment reconhecido e o '.'/'..' cru — %2e, %2e%2e, homoglifos, %5C e barras
  codificadas sao todos inertes.
Task 4: minor (deferred): o laco do teste de namespace passa VAZIO se `caminhos` ficar
  vazio — falta assert de length. Hoje nao dispara (os 4 ids hostis alcancam o servidor),
  mas uma guarda futura mais ampla mataria a prova em silencio. E a MESMA classe de
  defeito que este task ja teve. Vem do meu brief, nao do implementador.
Task 4: minor (deferred): servidor.close() sem try/finally nos dois testes — asserçao que
  falha no meio deixa o servidor ouvindo.
Task 4: complete (commits 106e7fc..0b5cc43, review clean, 2 minors deferidos)

Task 5: NEEDS_CONTEXT, 3 achados, todos reais e todos do plano:
  (1) @types/node ausente — os adaptadores desta task sao os primeiros do pacote a tocar
      node:fs/path/crypto. Estava na lista pre-aprovada pelo humano.
  (2) next@16.3.4 NAO publica campo `exports` (verificado). Sob ESM, subpath sem extensao
      em pacote sem exports nao resolve: NodeNext da TS2307, bundler compila.
      CONSEQUENCIA MAIOR: o mesmo vale em RUNTIME. Com criarProxy na raiz,
      import('@erp/nucleo') arrasta next/server e o pacote fica impossivel de carregar
      fora de bundler — inclusive nos proprios testes. O teste de exports da Task 6 faz
      exatamente esse import.
      DECISAO: criarProxy sai da raiz para @erp/nucleo/proxy. Sao QUATRO subpaths agora,
      nao tres. tsconfig do nucleo passa a preserve+bundler (contratos segue NodeNext).
  (3) Nucleo.store expunha StoreDeSessao inteiro, logo `ler()`, logo o accessToken. O
      teste que prova que sessao.atual() nao vaza ficaria VERDE enquanto
      nucleo.store.ler() entregava o token ao lado. Achado por iniciativa do implementador,
      nao pelo teste. Fix: store fora; sessao.abrir/encerrar no lugar.
  Plano corrigido (160823c). PENDENTE: refletir os 4 subpaths na spec e em 00-arquitetura,
  que ainda dizem "exatamente tres".

Task 5: review — spec OK, NEEDS FIXES, 2 Important:
  (1) Nucleo.identidade expunha autenticar(), que devolve SessaoArmazenada COM accessToken.
      Ultimo caminho de um Nucleo ate o token cru. Fix melhor que documentar o risco:
      sessao.entrar(credencial) autentica, cunha o id, grava e devolve SO o id — identidade
      sai do Nucleo inteiro.
  (2) exigir() usava this.atual(); destruturar quebrava. E NENHUMA das tres operacoes de
      sessao tinha teste — a que mais protege rota era a mais fragil do arquivo.
  Minor: criarProxy aceitava cfg.prefixo e nunca usava (agora usa, vira no-op fora do
  proprio prefixo se o matcher estiver errado).
  Plano corrigido (2a1635f), briefs 5 e 8 regenerados.

>>> PAUSA PEDIDA PELO HUMANO AQUI. O fix round do Task 5 NAO foi despachado. <<<
    repos/erp-nucleo esta em 0a6622f (29/29), estado ANTERIOR as correcoes acima.
    Retomar despachando o fix round 1/5 do Task 5. Ver docs/superpowers/ESTADO.md.
