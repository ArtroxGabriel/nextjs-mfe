# Handoff revisor_d29_1 (final)

Veredito: APROVA. Críticos 0, importantes 0, menores 2 (um é variante de limite já declarado).

Etapas concluídas: plano e diff do núcleo; gramática (leitura + execução do dist com strings hostis); doc x código; contrato de responderFragmento/criarFragmento; bump nas 4 apps; `pnpm test` do núcleo (286/286).

## Verificado
- Tokenização `<[^<>]*>|[^<>]+|[<>]`: `<`/`>` soltos reprovam; valor de atributo não aceita `"<>&` solto, crase, controle; `\n` dentro da tag reprova (ABERTURA só aceita espaço). Sem tag de texto bruto (script/style/textarea/title/xmp/noscript), sem svg/math/table/form/meta/base/img: nenhum caminho para script, navegação automática, recurso externo ou envio de formulário. `&nbsp` sem `;` reprova; nulo reprova; `\r` aceito (normalizado pelo parser, inofensivo).
- href: `/`, sem `//`, `/\`, `:`, `&`, espaço; `%0d%0a` aceito mas só caminho (sem esquema), inócuo.
- Regexes lineares, sem ReDoS (alternativas disjuntas).
- `ehHtmlInerte` não está no `index.ts` (só criarFragmento/responderFragmento): invariante 14 ok. Contrato igual: 500 no dono (linha ~179), `null` na consumidora (linha ~137).
- Doc §2.3 e ADR-0011 adendo 2 batem com o código (tags, atributos, href, pilha). §2.5 (sem cabeçalho serve v1; versão diferente 204) bate com `responderFragmento`.
- Apps: package.json, pnpm-lock e allowlist do workspace 0.10.4 nas 4 apps, diff mínimo.

## Menores
1. `fragmento.ts` TEXTO: aceita U+202E (override bidi), U+FEFF e U+0085 no texto/`aria-label`. Não executa nada; só pode inverter visualmente texto (spoof). Opcional: excluir `‎‏‪-‮⁦-⁩` em TEXTO e VALOR, com teste.
2. `id` livre aceita `id="__next"` e afins (DOM clobbering/colisão com âncoras da consumidora). Variante do limite D30 (`id`/`class` livres): sem impacto maior demonstrado; apenas sugiro citar clobbering na descrição de D30.

Nada em href para `/api/auth/logout` (GET): é "qualquer caminho da mesma origem" de D30, e o logout exige POST/ação (não confirmei no shell; suspeita baixa, confirmaria `grep` na rota de logout do shell).
