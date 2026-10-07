# Handoff challenger_d29_1 (parcial)

Etapas: 1 ambiente [ ] ; 2 fragmento hostil [ ] ; 3 dono [ ] ; 4 regressao [ ] ; 5 desligar [ ]

- Etapa 1 OK: Redis/Keycloak/Verdaccio no ar, showcase:checar ok, portas 3000-3003 e 4001-4120 livres antes; showcase subido com `ZONA2_URL=http://127.0.0.1:4500 task showcase -- --construir` (dona falsa em :4500).
- Etapa 2 OK (HTML e RSC, ana, 24 casos + controle; out-etapa2*.txt): todo caso hostil -> bloco some, página idêntica ao baseline (dona 204); controle aparece. Única diferença: BOM (U+FEFF) é ACEITO como texto (gramática §2.3 só exclui C0/DEL); BOM inicial é removido pelo decode de fetch; inerte, só o texto do bloco válido aparece. Não é falha; é nota.
- Etapa 3 OK: real zona2 direto: ana 200 (312B, private,no-store), bruno/carla/davi 204; document->404, versao 2->204, id outro->204; sem cookie 307 /login (proxy do núcleo; ADR-0011 d.6/02-zonas §2 dizem 204) e cookie inválido 204. Unidade (dist, react-server): 20 casos hostis -> 500 sem corpo, canônico 200, throw->500.
- Etapa 4 OK: `task verificar:redis` 123/123, fail 0, skipped 0, exit 0 (out-etapa4-verificar-redis.txt). A 1a tentativa falhou só por porta 3000 ocupada pelo meu showcase (pkill errado); refeita após derrubá-lo.
- Etapa 5 OK: showcase (PID subir.mjs) e dona falsa derrubados; Redis, Keycloak, Verdaccio ficam.

# Handoff challenger_d29_1 (final)

Veredito: APROVA. Nenhum HTML hostil chegou ao painel (HTML nem RSC).
Divergências/notas: (1) fragmento sem cookie na zona 2 direta dá 307 /login (proxy do núcleo), não 204 (ADR-0011 d.6, 02-zonas §2.3 tabela); a consumidora trata como ausência, sem efeito observável. (2) BOM/U+FEFF é aceito como texto (gramática só exclui C0/DEL; BOM inicial some no decode do fetch): inerte. (3) pnpm-lock.yaml de erp-dominio-stub e erp-moldura ficaram modificados (hash do @erp/contratos 0.2.1 deste Verdaccio), efeito de build/instalação nesta sessão; não commitar.
Portas liberadas: 3000-3003 e 4001-4120 conferidas livres (ss: 0 em escuta; sem processos servidor.mjs/next-server/dona-falsa); só 4873 (Verdaccio).
