# Handoff challenger_d2_1 (final) — veredito: APPROVE
Base no ar com `task showcase:oidc` (log no scratchpad). Scripts em esta pasta; saídas `out-*.txt`.
## Etapa 1 - Login (concluída)
- t1-login.mjs / out-t1.txt: login ok; replay do retorno -> /login; sem transação -> /login; transação inexistente -> /login;
  state adulterado, code trocado entre transações, state trocado, iss adulterado -> /login sem sessão;
  redirect_uri com 9 variantes (barra final, query, fragmento, maiúscula, outra porta, 127.0.0.1, host falso) -> 400 no Keycloak.
- t1b-pkce.mjs / out-t1b.txt: verifier errado invalid_grant; sem verifier invalid_grant; code reusado invalid_grant; sem PKCE recusado.
- Cookie de sessão: `__Host-session=<uuid>; Path=/; HttpOnly; Secure; SameSite=Lax` (sem Max-Age: cookie de sessão do navegador).

## Etapa 2 - Navegador (concluída)
- t2-navegador.mjs, t2d.mjs (RSC com ?_rsc seguindo o 307): bruno e carla, 7 rotas, HTML + RSC + 44 arquivos JS (2,3 MB) + cookies + headers: nenhum access_token/refresh_token/id_token/eyJ/refreshToken/idToken/accessToken/FINANCEIRO. O único acerto de "groups" é `.groups.a` num polyfill de regex nomeada do Next (falso positivo, out-t2.txt).
- Carla (admin de acesso) em r-1: sem "custo" no HTML nem no RSC; bruno vê (autorizado).
- Redis: usuário `zona` faz GET em erp:sessao:* e leva NOPERM em SET/DEL/KEYS/EVAL/outras chaves (out-t2c.txt). O GET devolve a sessão com accessToken e refreshToken (= D17, adiado).
- Nota: para um módulo negado, a requisição RSC devolve 200 com marca NEXT_HTTP_ERROR_FALLBACK;404 no payload, e para rota inexistente 404 (out-t2f.txt); r-3 e id inexistente idênticos (8325 B HTML / 5738 B RSC).
## Etapa 3 - Renovação (concluída, token 130 s, janela 60 s)
- t3.mjs / out-t3.txt: rajadas de 30 na janela (ana, bruno) todas 200, refresh# trocado uma vez; token já vencido há 92 s (carla, parada): 20 concorrentes todos 200 e sessão renovada; zero REFRESH_TOKEN_ERROR no log do KC durante o teste; userinfo com o access token do store: 200.
- t3b.mjs / out-t3b.txt (KC parado no meio; token 130 s): KC no ar: 200 concorrentes (davi) todas 200 e sessão renovada; KC parado dentro da janela: 200 (token ainda válido); renovação falha, lock 15 s segura; sessão permanece no Redis, token vencido + KC parado: 307 /login sem Set-Cookie; KC de volta: depois do lock, 1 de 10 concorrentes 200 e 9 x 307 /login (D19 observado, não reprova); sessão recuperada (token 130 s) sem novo login.
- Vida do token restaurada (`kcadmin.mjs padrao`, antes='130', 204).
- Ambiente: eva (login OIDC ok) dá 307 /login em toda página porque `dados/estado/gestao-acesso-v2.json` (persistido, não versionado) não tem a pessoa eva (só ana..davi); `/v2/eu` com o token dela = 401 SESSAO_EXPIRADA (t3e.mjs). Não é defeito do D2: estado velho do showcase; `task showcase:dados:resetar` não executado (apaga estado).
## Etapas 4, 5, 6 (concluídas; ver out-t4/t5/t6.txt)
- t4 (sair): 403 + sessão INTACTA e sem Set-Cookie para Origin evil/null/3001/3000.evil.example/3000@evil.example/sem porta/lixo/vazio e Sec-Fetch-Site cross-site/same-site/none/Same-Origin; passam (303) e removem a sessão: sem cabeçalho (documentado), `Origin: http://LOCALHOST:3000` (mesma origem), `Origin: https://localhost:3000` (esquema ignorado, só host), `Sec-Fetch-Site: same-origin` com Origin evil (forjável só fora do navegador). Sair legítimo: 303 ao KC, Redis sem a chave, cookie apagado; SSO do KC ativo antes de confirmar, `login_required` depois.
- t5 (HTTP local): sem flag 500 em toda rota; flag=1 + nip.io/evil.localhost/localhost./127.0.0.1.evil.example/localhost@evil.example/0.0.0.0/127.0.0.2 -> 500; flag=true e " 1" -> 500; `127.1` aceito (normaliza para 127.0.0.1); retorno e pós-logout externos http -> 500; zero conexões ao listener 4016.
- t6 (domínios): tokens forjados (none, HS256 com chave pública, RS256 minha chave, jwk/jku, RS384, payload/exp/aud/iss trocados, truncado), master realm, dev, vencido: todos 401 SESSAO_EXPIRADA; svc.zona1 só registra zona1 (zona2/ZONA1/' zona1'/['zona1'] = 403); svc.idp 403; primeiro-acesso/decisoes/eventos/rotas de domínio = 401 para svc.idp, svc.zona1, svc.bff.
- EFEITO COLATERAL MEU: `svc.acesso` registrou o módulo `acesso` (nome 'x', sem funcionalidades) em `repos/erp-dominio-stub/dados/estado/gestao-acesso-v2.json` (ignorado pelo git). O módulo não existia antes. Remover ao derrubar o showcase.
- Módulo 'acesso' (x) removido do estado após derrubar o showcase (python editando o JSON; indentação pode ter mudado, arquivo é ignorado pelo git). Showcase derrubado; portas livres (ss vazio).
- Resta no estado 1 evento de auditoria MANIFESTO_REGISTRADO de 'acesso' (e os de zona1 que reenviei idênticos); não removido (histórico).
- suites: verificar:redis x2 = 118/118 (40 s); verificar:oidc x2 = 5/5 (76 s).

## Fecho
- construir: `CONSTRUIR=1 task verificar:construir` x2 = 118 testes, 114 pass, 4 pulados (os 4 só valem com Redis), 0 fail (37 s cada).
- Keycloak: minha restauração inicial (`kcadmin padrao`) NÃO tirou o atributo (o PUT do KC mescla atributos; só `''` remove). Ficou `access.token.lifespan=12` e o `task showcase:checar` reprovou (`12 !== 300`). Corrigido gravando `''`; `kcshow.mjs`: atributo undefined, realm 300; `task showcase:checar` passou inteiro de novo. Defeito do meu script, não do produto.
- Log do KC (`docker logs --since 2h | grep REFRESH_TOKEN_ERROR`): na minha janela (14:23-14:50 UTC) só os eventos do próprio `showcase:checar` (14:22:21 e 14:49:59); nenhum durante t3, t3b nem verificar:oidc.
- Portas: showcase derrubado com SIGINT; `ss -ltn | grep -E ':(300[0-3]|40[0-2][0-9])\b'` sem linhas (contagem 0 às 14:50 UTC); sem next-server/servidor.mjs vivos. Redis, Keycloak, Verdaccio no ar.
