# Re-revisão Task 2 r1 (final)

Núcleo 3576971. `pnpm test`: 262/262 (rodado).

Veredito: LIMPO. Um Minor opcional.

- I1 ok: `motivo` literal fechado, sem dado sensível; console usa `f.motivo`; teste espera `['codigo','motivo','supportId']` e o valor.
- M1 ok: try/catch + `.catch` para Promise; cai no console sem a mensagem do erro. Teste cobre lançar e rejeitar (login e renovação).
- M6 ok: `href === origin + pathname`: barra final, porta padrão/explícita, host maiúsculo e caminho codificado são normalizados igual nos dois lados; `?`, `#`, `?#` recusados (testados).
- M2/M3/M4 ok: cada mutante citado falha (conferido pela lógica: 40/60 não registra; vida antiga fica e dá `em-dia`; `janelaMs/2` dá `em-dia`).
- Ajuste do M3 para `em-andamento` legítimo: o lock não é liberado (vale até o TTL, por desenho), então a 2ª renovação cai em `em-andamento` com token válido; com a vida antiga seria `em-dia`. Distingue o defeito.
- AGENTS.md: sem quebra (inv. 1, 3, 12, 15).

Minor: `criarNucleo.ts` (`r instanceof Promise`) não pega thenable não nativo que rejeita (rejeição sem tratamento). Opcional: `Promise.resolve(r).catch(...)`.
