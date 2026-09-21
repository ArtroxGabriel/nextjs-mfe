# auditor_base_1: gate da base genérica, iteração 2 (HEAD 8aa5a3e)

**Veredito: INTEGRITY VIOLATION** (veto)

A árvore real não foi tocada. Todas as mutações rodaram numa cópia (`scratchpad/repos-copia`). As portas
3000–3003, 4001–4004 e 4010 foram liberadas no fim, e o Verdaccio :4873 não foi mexido.
`git status` está limpo nos oito repositórios. O `erp-nucleo` aparece agora em `55a9e22`, um commit do orquestrador
das 11:39 que muda só um comentário. A cópia foi feita antes dele, com o núcleo em `d5912ce`.

## Reprodução dos números alegados
Os números do GATE_STATUS se reproduzem na cópia: contratos 15/15, núcleo 58/58, moldura 11/11, stub 16/16 e
ponta a ponta 23/23 (com CONSTRUIR=1). Não encontrei resultado fabricado.

## Mutações exigidas
Todas as mutações exigidas reprovam alguma suíte, com uma exceção. M1a (remover a recusa de `.` e `..`) sobrevive
porque é equivalente: a checagem final `url.pathname !== caminho` recusa os dois casos. Isso está provado por M1a2:
removendo as duas coisas, o teste reprova. A tabela completa está em `mutacoes.txt`.

## Por que é veto
O critério é o mesmo do auditor_final_1: um defeito que o gate anterior declarou resolvido pode voltar e as suítes
continuam verdes.

- **V1 — A1 do challenger_base_1 (Origin obrigatório) só é protegido em uma das duas apps que têm action.** A mutação X1
  remove `origemPermitida()` do `acaoProtegida` da zona 2 e os 23 testes passam. Na sondagem, `concluirTarefa` sem
  `Origin` executou e a tarefa t-2 ficou concluída. Com a checagem restaurada, a action é recusada.
  O teste "Server Action sem cabecalho Origin nao executa" tem nome genérico, mas só exercita `alterarConcessao`.
- **V2 — o teste N4 diz "o toast aparece ... uma vez", mas o "uma vez" não depende do código.** Ele faz o segundo
  pedido sem o cookie de flash, montado à mão. A mutação X5 remove `limparFlash()` do HostDeToast: o cookie
  (maxAge 60) nunca é apagado, o toast reaparece em cada documento durante 60 s, e todas as suítes passam.
- **V3 — D5 (degradação por bloco) foi declarado resolvido e não tem teste.** A mutação X23 tira o `.catch` do bloco do
  domínio A em /zona1 e tudo fica verde. Nenhum teste derruba um domínio.
- **V4 — o comportamento das ilhas da moldura não tem teste.** A DEFERRED diz que o risco D9/D10 "passa a ser
  requisito da base nova, verificado no gate dela", mas só o barramento é testado. Todas estas mutações ficam
  verdes nas suítes:
  - X22: o host nunca ouve o barramento, então `emitirToast` não mostra nada;
  - X3: `FormularioDeAcao` segue `//evil.com`;
  - X4: `FormularioDeAcao` engole a falha sem toast;
  - X6: o host só lê o flash na montagem, que é o achado 4 do reviewer_base_1.

  X6 hoje é quase inobservável, porque `location.assign` sempre remonta o host.

  O precedente V2 do auditor_final_3 vale aqui: um teste por captura de `react/jsx-runtime`, ou com um
  `document`/`EventTarget` falso, cobre isso sem dependência nova.

## Achados sem veto
- **M1a4.** O teste "parametro hostil" põe a chamada dentro de um `try` e só confere o formato das URLs que chegaram
  ao servidor. Se o parâmetro hostil for trocado por `'x'` em vez de recusado, a chamada vai para
  `/v1/recursos/x` e o teste fica verde. Nada exige `DestinoInvalido`. O ideal é
  `assert.rejects(..., DestinoInvalido)` e `recebidas.length === 0` por caso.
- **M1a3.** A checagem final de `montarUrl`, dita "redundante, de propósito", pode ser removida sem que nenhum teste
  reprove. O comentário manda ver o teste do byte de controle, mas esse teste não a exercita.
- **X2.** O teste estático do invariante 16 aceita `// await exigirModulo('...')`. Em X20 a remoção só foi pega pelo
  teste de comportamento. Em `recursos/[id]`, cujo módulo é livre para todos, a remoção passa.
  Existe alternativa comportamental: carla restringe `zona1.painel` pela action, e davi em `/zona1/recursos/r-1`
  deve receber 404.
- **X10 (equivalente).** Sem o CSP no cabeçalho da requisição, o Next 16.3.4 ainda aplica o nonce. O comentário de
  `criarProxy.ts` que diz o contrário é falso nesta versão.
- **Execução da suíte do núcleo.** `destinos.test.mjs` não fecha os servidores quando um assert falha, e a suíte fica
  pendurada em vez de reprovar. Faltam `after()` ou `t.after(fechar)` e um timeout.
- **Comentários sobre lint.** "o lint das zonas recusa" continua em `erp-shell/lib/nucleo.ts:4` e
  `erp-nucleo/src/adaptadores/sessao-arquivo.ts:31`. O 55a9e22 só corrigiu `shell/index.ts`.

## Testes estáticos em `repos/verificacao/base.test.mjs`
- **N3 estático.** O regex de import de `@erp/nucleo/shell` é aceitável como lint e pegou M6e. Ele não pega import
  indireto nem computado. Conferir o `.next` de cada zona seria mais forte.
  O regex do cookie (`cookies()).set('__Host-session'`) é fraco: `c.set(NOME, …)` passa. A alternativa é
  comportamental: nenhuma resposta de zona pode trazer `Set-Cookie: __Host-session`.
- **Invariante 16 estático.** Não é o melhor possível, porque é satisfeito por comentário (ver X2). Tem equivalente
  comportamental.
- **N8, `fetch(` direto.** É o melhor barato. Um equivalente parcial seria os stubs recusarem chamadas sem
  `x-erp-chamador`.

## O que não executei
- Não rodei mutações no `sair` ou no `entrar` do shell além de X18.
- Não usei navegador real: V2 e V4 foram mostrados pela sobrevivência das mutações, e não observados no DOM.
