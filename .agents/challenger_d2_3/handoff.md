# Handoff challenger_d2_3 (final) — veredito: APPROVE

1. Suítes (1x cada, out-*.txt): verificar:redis 118/118; verificar:oidc 5/5; CONSTRUIR=1 verificar:construir 118 (114 pass, 4 pulados, 0 fail); task test exit 0 (todos "ℹ fail 0"); showcase:checar exit 0.
2. Produto inalterado: `git diff aeae3af HEAD -- . ':!test'` no núcleo e `bce8f59 HEAD` no shell = vazio (só 83b00e0 e 3034f76, ambos test()).
3. Base OIDC no ar (out-login-cookie, out-t4, out-t2c, out-t2d, out-t2nav, out-p04):
 - __Host-erp-login: valor != state, ausente da URL, HttpOnly/Secure/SameSite=Lax/Path=/ Max-Age=600.
 - Varredura (bruno, carla; HTML+RSC seguindo 307; 44 JS, 2.336.416 B): sem access_token/refresh_token/id_token/eyJ/FINANCEIRO; único "groups" = polyfill do Next. Carla em r-1 sem "custo"; bruno vê (autorizado).
 - Redis zona: GET ok (D17), SET/DEL/KEYS/EVAL/outra chave = NOPERM; anônimo WRONGPASS/NOAUTH.
 - Logout: 403 sem mudança para Origin evil/null/3001/subdomínio/@/sem porta/lixo/vazio e Sec-Fetch-Site cross/same-site/none/Same-Origin; passa sem cabeçalho, mesma origem e forjado same-origin (igual rodadas 1-2); GET/PUT 405; SSO do KC cai após confirmar.
 - P04: token 130 s vencido há 8 s, GET / = 200, refresh trocado; REFRESH_TOKEN de ana 1 -> 2 (exatamente uma renovação), 2o GET / sem novo evento.
4. Fecho: eventos do realm restaurados (eventsEnabled false), lifespan '' chamado direto (antes '130', 204), task showcase:checar exit 0 (out-checar-final.txt). Showcase derrubado; portas livres (ss -ltn: 0 linhas). grep de JWT na pasta: nada.
Resíduo: eventos de login/refresh das minhas sessões ficaram armazenados no KC.
