# Re-revisão final r1 (final)

Veredito: limpo. A1 a A6 resolvem os achados; `cd repos/erp-shell && pnpm test` 82/82. Só observações Minor, sem correção exigida.

- A1 ok (ADR-0013 decisão 2 com ressalva; D17 "Fecha em" atualizado).
- A2 ok (11-testes.md §3.2 e PENDENCIAS.md apontam para proxy-renovacao.test.mjs, P0-d).
- A3 ok (oidc.test.mjs segue o logout, confirma, 302 para /login, controle SSO vivo/morto; ROTEIRO A11 descreve o real).
- A4 ok (CONFIGURACAO.md ERP_RENOVACAO_LOCK_S; D20).
- A5 ok (comentário de decisao-proxy.ts; D19).
- A6 ok (rotas-auth.ts:30-47, :107-112; 6 recusas e 3 aceites nas unidades; e2e base.test).
- DEFERRED: todos os B da triagem presentes (D12 x2, D14 x2, D17, D18, D19, D20 x5, D21, D22 x4, D23 x4); nenhum C; D19 "Fecha em: decisão do humano".

Observações Minor:
- m1: mesmaOrigem compara só `host` (esquema ignorado); SHELL_HOSTS sem trim/minúscula, igual a hostsPermitidos. Falha fechada.
- m2: CONFIGURACAO.md:42 SHELL_HOSTS mostra padrão "—", mas o código usa `localhost:3000`.
- m3: sem teste de unidade para esquema diferente/sufixo/maiúsculas (o código trata sufixo e maiúsculas).
