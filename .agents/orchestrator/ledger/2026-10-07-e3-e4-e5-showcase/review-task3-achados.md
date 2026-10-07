# Achados da revisão da Task 3 (final)

Veredito: Needs fixes (um erro factual, dois ajustes menores).

1. ROTEIRO linha F4 (docs/ROTEIRO-DE-VERIFICACAO.md, tabela do topo): "`/zona1/relatorios` como bruno" dá 200, não 404. O bruno tem `zona1.analista` na semente (relatorios.ver); só dá 404 depois de A8. Correção: "como ana" (A4 prova o 404 dela).
2. A14 e zona-demo: "a página de zona fora do ar aparece já no próximo carregamento" ignora a sonda com cache (`ERP_SONDA_TTL_MS`, 1 s, lib/saude-zonas.ts). Correção: "em até ~1 s (ERP_SONDA_TTL_MS)". Também falta dizer que é preciso ter entrado (F2/A14 abrem /demo sem sessão cairia no login).
3. A15: "o mesmo código está no registro do shell" confunde com "registro de destinos". Correção: "no log do shell (linha `[zona] ... supportId=`)". A afirmação em si é verdadeira nos 3 caminhos (sonda, mapa vazio, gateway) e a página só tem texto fixo, sem classe ou stack.
4. F6 e 412 de F7 deixam claro que só o teste prova; F6 diz "Nada a fazer no navegador" e depois "confira os package.json": ok.

Conferido sem defeito: atores e o que veem (conferir.mjs, semente), custo bruno/carla, bloco C1 só a ana, TTL 30 s, README/docs/README (conferir nos dois modos, 15 passos), "Preparar", grep de estilo sem ocorrências nas linhas novas, sem referência a negócio.
