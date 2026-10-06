# handoff challenger_d19b_2 (final)

**Veredito: APPROVE** (etapas 7 e 8; sem divergencia de produto).

## Etapa 7 - regressao dos ataques do D2 (OIDC, ERP_LOGIN_TRANSACAO_S padrao e 120)
Scripts: c7.mjs (varredura, ACL), c7b.mjs (replay/adulteracao/logout/sair), c7c.mjs (PKCE removido). Saidas: out-c7a-{default,120}.txt, out-c7b-{default,120}.txt, out-c7c-pkce-removido.txt. 1 execucao de cada (n=1 por caso).
- Cookie `__Host-erp-login`: `Path=/; Max-Age=600 (120 no 2o modo); HttpOnly; Secure; SameSite=Lax`; valor != state (43 chars cada); SET no Redis `erp:login:<hash>` com PX 599996 / 119995.
- Uso unico: retorno 1 -> 303 /zona1 com sessao; replay (2x) -> 303 /login sem Set-Cookie de sessao. Sem cookie, cookie de outra transacao, state adulterado, state ausente, code adulterado, `?error=` -> todos 303 /login sem sessao.
- PKCE/redirect_uri: code_challenge trocado -> troca de code falha, 303 /login; challenge removido -> Keycloak devolve error=invalid_request (Missing parameter code_challenge_method), 303 /login; state trocado na ida -> 303 /login; redirect_uri evil / outro caminho / `..` -> Keycloak HTTP 400.
- Varredura: 32 corpos (HTML, RSC, 21 scripts JS, /acesso de carla), 0 achados para access/refresh/id token, JWT, valor exato de token, groups, segredo do cliente (os dois modos).
- ACL zona: GET ok; SET, DEL, EXPIRE, SET NX do lock, FLUSHALL, KEYS, EVAL, CONFIG GET -> NOPERM. Sessao do shell intacta depois.
- Logout: POST sair com Origin evil / Sec-Fetch-Site cross-site / Origin null -> 403 {codigo,supportId}, sessao continua viva; mesma origem -> 303 ao logout do Keycloak (client_id, post_logout_redirect_uri), cookie limpo, /zona1 -> 307, confirmacao -> 302 /login, novo entrar pede senha. GET sair -> 405.
- Stub direto: sem Authorization 401 SESSAO_EXPIRADA; Bearer lixo 403 OPERACAO_NAO_PERMITIDA.
- Diferenca entre os dois modos: so Max-Age/PX (600 vs 120). Igual ao D2.

## Etapa 8 - suites (2 execucoes cada onde pedido)
- task test: exit 0 (contratos 20, nucleo 262, moldura 26, stub 75, shell 102, tudo pass) - out-c8-test.txt (1x)
- task verificar:estatica: 51/51, 2x - out-c8-estatica-{1,2}.txt
- task verificar:redis: 118/118, 2x (48,1 s e 44,7 s) - out-c8-redis-{1,2}.txt
- task verificar:oidc: 6/6, 2x (106,3 s e 105,5 s) - out-c8-oidc-{1,2}.txt
- task verificar (modo arquivo): 114 pass + 4 puladas (os 4 que so valem com Redis), 2x - out-c8-arquivo-{1,2}.txt
Portas 3000-3003/4001-4120 livres antes e depois; task showcase:checar exit 0 no fim. Submodulos: erp-dominio-stub e erp-moldura aparecem "m" (conteudo modificado) - nao investigado; a conferir pelo orquestrador (lockfiles conhecidos, segundo o handoff anterior).

## Divergencias declarado x observado
Nenhuma de produto. Observacoes:
1. Achado herdado do challenger_d19b_1 (nao reproduzido aqui): com o JWKS do stub frio, a recuperacao depois de o IdP voltar leva ~30 s (ERP_JWKS_INTERVALO_MIN_S).
2. zona1 direta em :3001 com cookie devolve 200 (out-c7a-default.txt). alvo.md:58 declara que a zona nao e alcancavel pelo navegador "em producao"; em loopback de dev e esperado, sem divergencia.
3. Chaves `erp:login:*` abandonadas acumulam ate o TTL (2 no padrao, 9 no modo 120 apos meus probes); expiram sozinhas.
4. Arquivos c7.mjs/lib.mjs contem as senhas de dev publicas do showcase (as mesmas do Taskfile); nenhum JWT/cookie de sessao (grep eyJ..eyJ vazio).
