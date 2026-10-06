# Revisão Task 2 C1 - achados (final)

Veredito: Spec ✅ | Qualidade: aprovada.

Conferido: código e testes idênticos ao brief (decisao-proxy.ts, proxy.ts, 2 testes de unidade, C1b); guarda antes da sonda e do cookie; 404 sem corpo + no-store; fora de zona segue a regra de sempre; commits sem rodapé de coautoria; árvore fora de commit intacta (docs e pnpm-lock). Unidades de proxy.test.mjs: 11/11 verdes (rodadas por mim).

Checagem de grafias (script chamando decidirAcaoDoProxy, matcher do proxy cobre tudo exceto _next/static):
- Recusadas: _fragmento, _FRAGMENTO, %5F/%5f, %5F%46, `_fragmento%2Fx`, `/zona2/_fragmento`, com `/` final, e `-static/_fragmento`.
- `/./`, `/%2e/`, `/../`: o URL do proxy (req.nextUrl.pathname) já normaliza antes da decisão, logo chegam como `/zona2/_fragmento` e são recusadas. Só escapariam se a decisão recebesse o caminho cru, o que o proxy.ts não faz.
- `;`: `_fragmento;a` não é o segmento `_fragmento`; a rota da zona não casa. Sem escape.
- `%255F` (duplo): decodifica uma vez para `%5Ffragmento`, segmento literal que a zona não casa com a rota. Sem escape.

## Critical
Nenhum.
## Important
Nenhum.
## Minor
1. (suspeita) `//zona2/_fragmento/x`, `/zona2//_fragmento/x`, `/zona2/%2F_fragmento/x` e `/zona2%2F_fragmento/x` retornam 'prosseguir' (o regex exige segmento não vazio e `%2F` decodificado vira barra dupla). Provável não alcançar a zona (rewrite `:caminho*` não casa segmento vazio; `%2F` fica dentro de um segmento e a zona não tem essa rota; a rota da zona ainda exige sessão, C1a). Confirmaria: acrescentar essas grafias ao C1b e rodar contra a base. Endurecer opcional: colapsar `/+` antes do regex.
2. `/zona2-static/_fragmento/...` também vira 404 (cobre além do brief; inofensivo, só se houver asset estático com esse nome).
3. C1b não inclui as grafias `//`, `%2F`, `%255F` nem `%5F` no 1º segmento; só unidade cobre `%5ffragmento` minúsculo.
