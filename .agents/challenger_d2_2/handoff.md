# Handoff challenger_d2_2 (final) — veredito: APPROVE
Etapa 0: leitura concluída. Iniciando suítes.
## Etapa 1 (concluída): redis x2 = 118/118; oidc x2 = 5/5; CONSTRUIR=1 construir x2 = 118, 114 pass, 4 pulados, 0 fail; task test exit 0; showcase:checar exit 0 (out-*.txt).
## Etapa 2 (concluída)
- Ambiente (`out-environ.txt`, só nomes): zonas 3001-3003 e domínios 4001-4004/4020 sem IDP_CLIENTE_SEGREDO, IDP_CLIENTE_ID, IDP_URL_RETORNO, IDP_URL_POS_LOGOUT, REDIS_URL, ERP_REDIS_SENHA_SHELL (nem qualquer nome com SEGREDO/SENHA/SECRET/TOKEN/PASS/CLIENTE/RETORNO/LOGOUT). Zonas têm IDP_EMISSOR e REDIS_URL_ZONA (esperado). Shell (3000) tem IDP_CLIENTE_SEGREDO e REDIS_URL (esperado).
- `__Host-erp-login` (`out-login-cookie.txt`): valor != state; valor não aparece na URL de autorização nem como substring de param; atributos HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age=600.
- Página `/` sem visitar zona (`out-p04.txt`, `out-p04-eventos.txt`): token (130 s) vencido há 8 s -> GET / = 200 (10125 B), refresh trocado; eventos KC (habilitei eventos do realm temporariamente): exatamente 1 REFRESH_TOKEN. Repetido com rajada de 10 concorrentes (bruno, `out-p04b*.txt`): 1 renovação, 1x200 + 9x307 /login (D19 declarado em DEFERRED, a fechar na task D19-B).
- Mudanças que fiz no KC: eventsEnabled true (config original em kcevcfg-original.json, restauro no fim); lifespan voltou a '' .
## Etapa 3 (concluída): regressão da rodada 1 (out-t2.txt, out-t2c.txt, out-t2d.txt, out-t4.txt)
- Varredura (bruno, carla; 7 rotas HTML+RSC seguindo o 307; 44 JS, 2.336.416 B): nenhum access_token/refresh_token/id_token/eyJ/FINANCEIRO; único acerto de "groups" = `.groups.a` do polyfill do Next (falso positivo, igual à rodada 1). Carla em r-1: sem "custo" no HTML nem RSC; bruno vê (autorizado).
- Redis, usuário zona: GET ok (D17, adiado); SET/DEL/KEYS/EVAL = NOPERM; outra chave NOPERM; senha errada WRONGPASS.
- Logout: 403 sem mudança para Origin evil/null/3001/subdomínio/@/sem porta/lixo/vazio e Sec-Fetch-Site cross-site/same-site/none/Same-Origin; passam sem cabeçalho, mesma origem (host, esquema ignorado), forjado same-origin; GET/PUT 405; logout legítimo remove sessão, SSO do KC cai após confirmar. Idêntico à rodada 1.
## Fecho
- Atenção: meu `kcadmin.mjs ''` foi no-op (argv vazio é falsy) e deixou lifespan=130; `task showcase:checar` deu exit 201; corrigido chamando `vida('')` direto (antes '130', 204); checar exit 0. Defeito do meu script.
- Eventos do realm: config restaurada (eventsEnabled false); restam 64 eventos armazenados no KC das minhas sessões (resíduo).
- Showcase derrubado por SIGINT; `ss -ltn | grep -E ':(300[0-3]|40[0-9][0-9]|41[0-2][0-9])\b'` = 0 linhas. Sem JWT nas evidências (grep).
