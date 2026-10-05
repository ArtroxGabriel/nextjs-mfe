# Handoff challenger_d2_1 (parcial)
Base no ar com `task showcase:oidc` (log no scratchpad). Scripts em esta pasta; saídas `out-*.txt`.
## Etapa 1 - Login (concluída)
- t1-login.mjs / out-t1.txt: login ok; replay do retorno -> /login; sem transação -> /login; transação inexistente -> /login;
  state adulterado, code trocado entre transações, state trocado, iss adulterado -> /login sem sessão;
  redirect_uri com 9 variantes (barra final, query, fragmento, maiúscula, outra porta, 127.0.0.1, host falso) -> 400 no Keycloak.
- t1b-pkce.mjs / out-t1b.txt: verifier errado invalid_grant; sem verifier invalid_grant; code reusado invalid_grant; sem PKCE recusado.
- Cookie de sessão: `__Host-session=<uuid>; Path=/; HttpOnly; Secure; SameSite=Lax` (sem Max-Age: cookie de sessão do navegador).

**PENDENTE DE RESTAURAR:** vida do access token do erp-shell no KC foi posta em 130 s (`node .agents/challenger_d2_1/kcadmin.mjs padrao` restaura).
