# Review task 1 (final)

Veredito: Approved. Nenhum Critical nem Important. Três Minor.

## Spec
- Conforme: `src/fabricas/fragmento.ts` é a implementação do brief palavra por palavra (tags, atributos globais, `a: href`, `time: datetime`, valores entre aspas duplas, entidades, HREF, atributo repetido, pilha). Assinatura `ehHtmlInerte(html): boolean` mantida; `export function` no mesmo módulo; sem mudança em `index.ts` (o diff não toca nele). `package.json` 0.10.4. Commit sem rodapé de coautoria (só o assunto aparece no diff; rodapé completo não verificável aqui).
- Testes: o arquivo de teste é o do brief (15 testes novos + import).
- Não verificável a partir do diff: M1–M13 (tabela do relatório, não rerodada), "286 pass", "sem push", `import 'server-only'` mantido (fora dos hunks).

## Segurança (dangerouslySetInnerHTML)
Nenhum desvio encontrado no raciocínio sobre a gramática:
- `TOKEN` + `ABERTURA` cobrem a string inteira; `<` e `>` não existem em texto nem em valor, então não há como fechar uma tag e abrir outra dentro de um atributo.
- Sem `svg/math/style/noscript/template/textarea/title`, não há modo do parser (RCDATA, foreign content) que reinterprete o conteúdo. Sem mXSS.
- href só `/` + `[A-Za-z0-9-._~/?=%#]`: sem `:`, sem `&` (nenhuma entidade de `javascript:`), sem `//` e `/\`.
- Nenhum atributo `on*`, `style`, `src`, `srcdoc`, `target`. Valores sem `"`, crase, controle.
- Regex lineares (alternativas disjuntas em TEXTO/VALOR; ABERTURA sem ambiguidade): sem ReDoS. `ATRIBUTOS_DA_TAG[tag]` só é lido depois de `TAGS.has(tag)`, então não há chave de protótipo.

## Minor
1. `src/fabricas/fragmento.ts` (ABERTURA/pilha): pilha balanceada não é aninhamento válido para o parser HTML. `<p><ul></ul></p>`, `<a><a></a></a>` ou `<li>` fora de lista passam, mas o navegador reestrutura (fecha o `p` antes do `ul`, cria `<p></p>` vazio). Não é vetor de execução, apenas divergência de DOM. Registrar como limite conhecido, não exigir.
2. `id` e `class` aceitam qualquer valor limpo: dá para clobbering de `id` (colidir com id usado pela página) e para reutilizar classes de CSS da consumidora (sobreposição visual). Impacto baixo e dentro da lista do brief. Convém anotar em D30/limites.
3. `href` aceita qualquer caminho local, incluindo rotas GET com efeito (por exemplo logout, se existir). Só dispara com clique do próprio usuário e o domínio decide; registrar como limite aceito. Testes: não há caso de `id`/`datetime` com valor hostil nem de `<a>` aninhado documentando o limite 1.

## Pontos fortes
Implementação mínima, sem sanitizar (continua `boolean`); testes com mensagem de falha (`html` no assert), laços por categoria, positivos e negativos balanceados; testes antigos preservados e o relatório de TDD (RED/GREEN) e mutações é específico por teste.

## Assessment
**Task quality:** Approved
**Reasoning:** Código idêntico ao brief, gramática estreita sem desvio de segurança identificado para `dangerouslySetInnerHTML`; apenas limites documentáveis.
