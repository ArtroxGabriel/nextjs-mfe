# ADR-0011 — Fragmento entre zonas: fábrica do núcleo, cookie como identidade

**Status:** aceita · **Data:** 2026-09-21 · **Afeta:** `@erp/nucleo` 0.5.0, `02-zonas.md` §2, `00-arquitetura.md` §6, `alvo.md` §6

## Contexto

Uma zona precisa mostrar, no HTML do servidor, um bloco cujo dado pertence a outra zona
(`alvo.md` §3). O contrato HTTP já está em `docs/desenho/mfe/02-zonas.md` §2
(`GET /{zona}/_fragmento/{nome}/{id}`, 200 com HTML inerte ou 204, timeout de 2 s,
`private, no-store`). Faltava decidir onde o código mora e como a identidade chega à zona dona.
Decisão preparada pelo `arquiteto-mfe` em 2026-09-21.

## Decisões

1. **Consumidor: `criarFragmento`, fábrica do núcleo, exportada na raiz.** O timeout e o
   `try/catch` são núcleo, porque sem eles a queda da zona dona derruba a consumidora
   (`00-arquitetura.md` §6.2). É fábrica e não porta: não existe uma segunda forma de buscar
   fragmento, e porta sem variação é só indireção (ADR-0009, decisão 12). Não precisa de
   `next/server` nem de React, então fica na raiz, sem subpath novo.
2. **Não reaproveita o registro de destinos.** O registro injeta `Authorization: Bearer`
   e `normalizar()` lança erros tipados de JSON. O fragmento usa cookie e nunca lança:
   devolve `html | null`. Dar um segundo significado a `credencial` ou a `normalizar` é a
   contaminação que `03-extensoes.md` §8 proíbe. A disciplina do elemento 7 vale igual:
   zona, nome e origem vêm de uma allowlist declarada; o cliente só preenche o `id`, validado.
3. **Identidade: o cookie `__Host-session` é repassado como veio.** A zona chamadora nunca
   afirma quem é o usuário (`02-zonas.md` §2.1). A zona dona lê a sessão do store
   compartilhado pelo mesmo caminho de uma navegação. Isso é leitura, não escrita
   (invariante 15), e a rota continua exigindo sessão (invariante 10).
4. **Origem da zona dona: registro local da app consumidora** (`lib/nucleo.ts`, com
   variável de ambiente e padrão de desenvolvimento), como os domínios. O `zonas.json` é do
   shell; as zonas são repositórios separados e não o importam.
5. **Dono: rota na app, helper no núcleo.** A rota `app/{zona}/_fragmento/{nome}/[id]/route.ts`
   conhece o dado e o módulo. `responderFragmento(req, produzir)` centraliza o que não pode
   divergir entre zonas: `Cache-Control: private, no-store`, recusa de navegação direta,
   versão do contrato, HTML inerte e a tradução de erro.
6. **Ausência é 204, inclusive módulo negado e sessão inválida.** O contrato não tem 404
   (`02-zonas.md` §2.2), e ausência de permissão é ausência de elemento (invariante 8). Na rota
   de fragmento, use `nucleo.acesso.exigirModulo` (lança `NaoEncontrado`), não o `notFound()`
   da página.
7. **HTML com script no dono vira 500 sem corpo.** Era a questão que o arquiteto deixou em
   aberto. Com 500, o bug de composição aparece no log e no alarme da zona que o causou; a
   consumidora trata 500 como ausência, então a página dela não quebra. Um 204 esconderia o bug
   atrás da mesma resposta que uma ACL negada. A consumidora também recusa HTML ativo, como
   segunda barreira.
8. **Navegador não alcança `_fragmento`.** A rota recusa com 404 pedido com `Sec-Fetch-Dest`
   diferente de `empty` (navegação de documento, iframe). O shell também recusa
   `/{zona}/_fragmento/...` (defesa em profundidade, na fatia que liga as zonas). A chamada
   real é servidor→servidor, direto na origem da zona, sem passar pelo shell.

## Consequências

- `@erp/nucleo` 0.5.0 (aditivo). `@erp/contratos` não muda nesta fatia.
- A primeira ligação real (zona 1 consumindo um bloco da zona 2) e o bloqueio no shell vêm depois
  do gate do shell, que está em andamento.
- Versão do contrato: só a 1 existe. Pedido de outra versão recebe 204.
