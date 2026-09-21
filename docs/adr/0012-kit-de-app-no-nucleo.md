# ADR-0012 — Kit de app: o código copiado nas 4 apps vira `@erp/nucleo/app`

**Status:** aceita, implementação depois do gate do shell · **Data:** 2026-09-21 · **Afeta:** `@erp/nucleo` 0.6.0 e 0.7.0, `@erp/moldura` 0.4.0, as 4 apps

## Contexto

`lib/pagina.ts` (sessão da página, `exigirModulo`, envelope de Server Action), `lib/indisponivel.tsx`
e `app/global-error.tsx` são idênticos no shell e nas três zonas; `scripts/registrar-manifesto.ts`
e o `proxy.ts` das zonas diferem só no nome da zona. O custo apareceu no gate do shell: o
fail-open de `exigirModulo` entrou nas 4 cópias em 4 commits, e o `proxy.ts` do shell perdeu parte
da CSP ao copiá-la. O humano decidiu "evitar duplicação e manter consistência" (2026-09-21).
Desenho do `arquiteto-mfe`.

## Decisões

1. **É núcleo.** Desligar `exigirModulo` ou `acaoProtegida` muda autorização e resposta HTTP
   (invariantes 5 e 16). Mora em `fabricas/criarPaginas.ts`, exportado no subpath novo
   **`@erp/nucleo/app`**: `criarPaginas(nucleo, { rotaLogin, hostsPermitidos })` devolve
   `sessaoDaPagina`, `modulosPermitidos`, `exigirModulo` (fail-closed), `caminhoAtual` e
   `acaoProtegida`.
2. **O núcleo não importa `@erp/moldura`.** A moldura não tem lockstep; se o contrato de
   autorização dependesse dela, uma versão não travada decidiria acesso. `acaoProtegida<R>` toma
   a decisão de segurança (origem, sessão, módulo) e, ao negar, chama o `aoNegar(motivo)`
   injetado para produzir o retorno. O núcleo nunca sabe o que é um toast.
3. **A parte visual vai para a moldura.** `@erp/moldura` 0.4.0 ganha `ServicoIndisponivel`,
   `ErroGlobal` e `criarDadosDaMoldura` na raiz; o que grava o flash no servidor
   (`next/headers`) vai para o subpath novo **`@erp/moldura/servidor`**, para a raiz continuar
   sem Next. A moldura pode depender do núcleo; o contrário não. Um bug nela mostra o toast errado,
   nunca libera acesso, porque a decisão já foi tomada no núcleo.
4. **O shell para de copiar a CSP.** `politicaDeSeguranca(nonce)` sai de dentro do `criarProxy`
   como função pura em `@erp/nucleo/proxy`; o `proxy.ts` do shell a usa e mantém a própria
   decisão (sonda, 503, telemetria). `criarProxy` não ganha flags do shell: as zonas o chamam e
   esquecem.
5. **Arquivos-modelo que ficam nas apps:** `app/global-error.tsx` (o Next exige o arquivo;
   o corpo vira um re-export de `ErroGlobal`) e `scripts/registrar-manifesto.ts` (o token é a
   identidade de serviço de cada app). A lógica do registro vai para `registrarManifesto()` na
   **raiz** do núcleo, que já é garantidamente livre de `next/server` e roda fora do Next.
6. **Migração atômica.** O gate de lockstep exige a mesma versão exata do núcleo nas 4 apps,
   então cada versão (0.6.0: CSP; 0.7.0: kit) entra nas 4 no mesmo commit, com
   `base/verificacao` verde antes do envio.

## Testes exigidos

- unidade no núcleo: `exigirModulo` com a gestão de acesso rejeitando **propaga o erro** (hoje só o
  L1 ponta a ponta prova o fail-closed); `acaoProtegida` negada nunca chama `corpo()`, e origem
  inválida nem consulta sessão;
- exports: `./app` entra na lista de subpaths; a raiz exporta `registrarManifesto`;
- moldura: `ErroGlobal`, `ServicoIndisponivel`, `criarDadosDaMoldura`, flash no servidor;
- `base/verificacao` continua com os mesmos 30 testes verdes.

## Recusado

- o núcleo importar a moldura (decisão 2);
- flags do shell no `criarProxy` (decisão 4);
- porta nova para acesso ou mensagem de ação: não há segunda implementação (ADR-0009, decisão 12);
- migração app a app (decisão 6).
