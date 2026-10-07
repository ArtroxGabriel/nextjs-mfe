# Handoff challenger_c1_1 (final)

Veredito: APROVA (nenhuma grafia alcançou a rota da zona 2 pelo shell; nenhuma divergência bloqueante).

Etapas (todas feitas; saídas brutas nos .txt desta pasta, sem cookie/token):
1 ambiente: Redis, Keycloak, Verdaccio no ar; portas 3000-3003/4001-4120 livres antes.
2 grafias pelo shell (etapa2-shell.txt, etapa2-redirects.txt): 50 grafias, com e sem cookie; nenhuma devolveu o fragmento.
3 origem zona 2 (etapa3-origem.txt): atores, cookie forjado, versões, chaves, Sec-Fetch-Dest, métodos.
4 vazamento (etapa4-vazamento.txt, etapa4-js.txt): bruno/davi/carla/eva sem bloco, títulos ou "Tarefas pendentes" em HTML e RSC; nenhum token/grupo no HTML/RSC/9 JS (único "groups" é polyfill de RegExp).
5 degradação (etapa5-degradacao.txt): zona 2 congelada 2,03 s (n=5), derrubada 0,02 s, domínio C congelado 2,03 s; painel e demais blocos presentes; bloco volta.
6 regressão: task verificar 123 testes, 119 pass, 4 skipped, 0 fail; task verificar:redis 123/123 (verificar*.txt).

Divergências menores (não bloqueantes) — ver relatório.

portas liberadas (3000-3003 e 4001-4120 conferidas livres, nenhum next-server/servidor.mjs vivo)
