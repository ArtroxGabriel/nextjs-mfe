# Handoff auditor_d29_1 (final)

**Veredito: PASS.** 61 execuções de mutação (M1–M13 com variantes, N1–N19, I1–I3): 51 pegas, 10 vivas; nenhuma viva é defeito de produto nem erro de boa-fé que deixe HTML ativo passar.

Gate D29, iteração 1. Alvo: `@erp/nucleo` 0.10.4 (`repos/erp-nucleo`, 610217d..50a0fea), `ehHtmlInerte` por lista de permissão.

## Etapas
1. [x] Reaplicar M1–M13 do plano — todas pegas. Variantes: M4b (`&` sozinho no HREF) VIVA, mutante equivalente: VALOR roda antes e só deixa `&` dentro de escape terminado em `;`, e `;` não está no HREF; M4c (`&` e `;`) PEGA. M13b (`i` só no FECHAMENTO) VIVA, equivalente: o pop compara com a tag minúscula aberta. Nenhum defeito.
2. [x] Mutações novas de boa-fé (N1–N19, 29 execuções). Vivas, todas sem defeito de produto:
   - N3 (`>` no VALOR), N4c/N4d (ABERTURA/FECHAMENTO sem âncora), N11 (lookahead sem `\\`), N7 (maiúscula só no nome do atributo): **equivalentes** (TOKEN já corta em `<`/`>`; char class do HREF não tem `\\`; Sets em minúsculas).
   - N6a (`%` fora do HREF) e N6c (exigir `%XX`): **restringem** (fecham recusando); falta caso positivo com `%` — menor de teste.
   - N9 (ordem `atributosValidos` antes de `TAGS.has`): sem defeito no fonte; com a troca, `<constructor href="/a">` lança TypeError (protótipo de objeto literal) — fecha recusando (consumidora null, dona 500). Menor: `ATRIBUTOS_DA_TAG` poderia ser `Map`/`Object.create(null)`.
   - N10a/N10b (`cache`/`redirect`) e N18 (content-type): PEGAS.
   - Achado de parser (sonda parse5, não mutação): `<li><div><li>…</li></div></li>` passa e, no SSR, fecha o contêiner e ancestrais `div` da consumidora. Sem execução, sem captura de conteúdo do host. Cabe no limite D30 (a), mas o texto dele ("reestrutura o DOM") não diz que sai do contêiner: menor de documentação.
3. [x] Integração.
   - O núcleo chega às apps como pacote instalado do registro (`node_modules/.pnpm/@erp+nucleo@0.10.4…`, cópia, não link). Testar o núcleo **mutado** ponta a ponta exige republicar: **não republicado — limite do método.** Também não editei a cópia instalada (store do pnpm é por hardlink).
   - `dist/fabricas/fragmento.js` instalado nas zonas 1 e 2 é idêntico byte a byte ao build do fonte limpo.
   - Produtor real (`erp-zona-2/lib/fragmento-tarefas.ts`) passa pelo `ehHtmlInerte` instalado: vazio, normal, títulos hostis, unicode, tab/LF/CR.
   - I1–I3 (tirar `section`, `data-fragmento`, `aria-labelledby`): pegas no núcleo pelo teste do bloco canônico. Ponta a ponta, por leitura: a dona viraria 500, e C1a (`status 200` + `data-fragmento`) e C1c (bloco no painel) reprovariam.
   - **Menor novo:** título de tarefa com controle (U+0000, U+000B, U+007F) reprova o bloco inteiro (dona 500, ausência na consumidora). Na base não há caminho de entrada (títulos fixos no stub); comportamento documentado em §2.3 e ADR-0011 d.7. O `escapar()` da zona 2 deveria trocar controle por espaço; sem veto.
4. [x] Regressão com fonte limpo: `pnpm test` no núcleo, 286/286 (build + fronteira + todas as famílias). `dist` reconstruído do fonte limpo, idêntico ao instalado nas zonas. `git status`: núcleo, shell, zonas 1/2/acesso e contratos limpos; `erp-dominio-stub` e `erp-moldura` têm `pnpm-lock.yaml` modificado desde 2026-10-01, anterior a este gate e intocado por mim. Nenhum commit.

## Vivas (10)
| id | mutação | classificação |
|---|---|---|
| M4b | `&` sozinho no HREF | equivalente (VALOR só deixa `&` em escape com `;`, e `;` não está no HREF); M4c (`&;`) pega |
| M13b | flag `i` só no FECHAMENTO | equivalente (pop compara com tag minúscula) |
| N3 | `>` aceito no VALOR | equivalente (TOKEN corta em `>`) |
| N4c | ABERTURA sem `^`/`$` | equivalente (token tem um só `<` e um só `>`) |
| N4d | FECHAMENTO sem `^`/`$` | equivalente (idem) |
| N7 | maiúscula no nome de atributo | equivalente (Sets em minúsculas) |
| N11 | lookahead do HREF sem `\\` | equivalente (char class sem `\\`) |
| N6a | `%` fora do HREF | restringe, fecha recusando; menor de teste (sem caso positivo com `%`) |
| N6c | HREF exige `%XX` | restringe, idem |
| N9 | `atributosValidos` antes de `TAGS.has` | sem defeito no fonte; com a troca `<constructor href>` lança TypeError e fecha recusando; menor: `ATRIBUTOS_DA_TAG` sem protótipo |

## Menores (sem veto)
1. `escapar()` da zona 2 não trata controle: título com U+0000/U+000B/U+007F derruba o bloco inteiro (dona 500). Na base não há entrada de título.
2. D30 (a) subestima o alcance: `<li><div><li>…</li></div></li>` passa e, no parse do documento (SSR), fecha o contêiner e ancestrais `div` da consumidora (parse5). Não há execução nem captura de conteúdo do host (fuzz de 600k), e o React refaz no cliente com innerHTML contido. Ajustar o texto do D30.
3. Teste positivo com `%` no `href`; teste com `<constructor href>`.

## Limite do método
Mutação do núcleo ponta a ponta exigiria republicar o pacote; não republicado. Coberto por leitura de C1a/C1c e pelo teste do bloco canônico no núcleo.

Mutações: `.agents/auditor_d29_1/mutacoes.txt`
