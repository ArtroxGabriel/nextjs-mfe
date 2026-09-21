# ADR-0010 — Reconciliação de dois `@erp/nucleo` 0.3.1 divergentes

**Status:** aceita · **Data:** 2026-09-21 · **Decisor:** Wilson (humano), por recomendação do agente · **Afeta:** `repos/erp-nucleo`, lockfiles de `repos/erp-shell` e `repos/erp-zona-*`

## Contexto

Os commits do núcleo que passaram pelos dois gates da base genérica e pelo veto forense
(`ecc376b` → `d5912ce` → `55a9e22` → `78980a4`, versão 0.3.1) ficaram só na máquina do
Wilson. O submódulo estava com HEAD destacado, e o push do repositório principal não
levou esses commits. O repositório principal (`fd65106`) fixava o submódulo em `78980a4`,
um commit que não existia no remoto.

O Gabriel não tinha como buscar esse commit. Ele reescreveu o núcleo (`45e0fe8` →
`2398dc3` → `dbfde02`), publicou-o como 0.3.1 no Verdaccio local dele e gerou os lockfiles
do shell e das zonas contra esse tarball (integridade `sha512-+DhOJ8…`). O Verdaccio desta
máquina tem o 0.3.1 do Wilson (`sha512-epx9mr…`). Resultado: dois artefatos diferentes
com o mesmo número de versão.

## O que cada versão tem

| Aspecto | `78980a4` (Wilson) | `dbfde02` (Gabriel) |
|---|---|---|
| Escritor único da sessão (N3, invariante 15) | `entrar`/`encerrar` só em `@erp/nucleo/shell`; `sessaoArquivo` na raiz é só leitor | toda zona recebe `entrar`/`encerrar`; `sessaoArquivo` na raiz grava |
| Sessão sem perfis | sessão carrega `sub` e `nome` | sessão volta a carregar `roles` |
| Atores de desenvolvimento | `ana`, `bruno`, `carla`, `davi` | os quatro mais `gabrigas`, `marina`, `rafael` |
| `modulosPermitidos` | exige sessão antes de consultar | não exige |
| Registro de destinos | validado no boot (origem, caminhos, métodos, credencial) | valida só na chamada |
| Redirecionamento do domínio | `redirect: 'manual'` | segue redirecionamento |
| Erro de rede → `ERRO_INTERNO`; `x-erp-caminho`; `x-erp-flash` | sim | sim |
| Testes | 57 | 32 (apagou `acesso.test.mjs`, reduziu `fronteira.test.mjs`) |

A versão do Gabriel não traz nada que a do Wilson não tenha. Os três itens da mensagem de
`dbfde02` (erro de rede, flash, `x-erp-caminho`) já estão em `78980a4`. O alias `corpo`/`body`
não é usado por nenhuma aplicação.

O código novo do Gabriel no shell e nas zonas (roteamento unificado, 503 de zona fora do ar,
gateway de telemetria, indisponibilidade de acesso) compila com `tsc --noEmit` contra o
0.3.1 do Wilson, e os 22 testes do shell passam. Esse trabalho não depende do núcleo
reescrito.

## Decisão

1. **O conteúdo do núcleo é o de `78980a4`.** Ele é o que passou pelos gates e preserva os
   invariantes N3, sessão sem perfis e destinos travados no boot.
2. **O histórico do Gabriel é preservado, sem force-push.** O `master` do `erp-nucleo`
   recebe um merge com estratégia `ours` de `dbfde02`: os commits dele continuam no
   histórico, a árvore fica igual à de `78980a4`, e o push é fast-forward.
3. **A versão sobe para 0.3.2.** Um número de versão tem de identificar um único conteúdo.
   Republicar 0.3.1 deixaria os dois tarballs em circulação sob o mesmo nome. O 0.3.2
   torna a troca explícita em qualquer máquina.
4. **Os lockfiles do shell e das zonas são regenerados contra o 0.3.2** do Verdaccio. A
   verificação de ponta a ponta (`repos/verificacao`) roda antes de qualquer commit no
   repositório principal.
5. **O código novo do shell e das zonas passa por gate** (revisor, challenger, auditor
   forense com veto), porque nunca passou por nenhum.
6. **Todo commit de submódulo é enviado antes de o repositório principal apontar para ele.**
   Foi a falta disso que causou a divergência.

## Consequências

- O Gabriel precisa atualizar o Verdaccio dele (publicar ou buscar o 0.3.2) e reinstalar o
  shell e as zonas. O 0.3.1 dele fica órfão e não deve ser usado.
- Nenhuma alteração de API para o shell e as zonas: eles já consomem a API de `78980a4`.
- Regra para os próximos pushes: `git submodule foreach 'git status -sb'` antes do push do
  repositório principal, e recusar HEAD destacado com commits não enviados.
