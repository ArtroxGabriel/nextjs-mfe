# Medição 1 (D2) — Concorrência de Refresh Token no Keycloak 26

**Data:** 2026-09-23  
**Ambiente:** Keycloak 26.0 (Docker showcase, realm `erp`, cliente `erp-shell`)  
**Script de medição:** [`base/showcase/medicao-refresh-concorrente.mjs`](medicao-refresh-concorrente.mjs)

---

## 1. Pergunta da medição

Quando duas abas do navegador ou requisições concorrentes tentam renovar o token ao mesmo tempo usando o mesmo refresh token:
- O Keycloak tolera a concorrência (ex: janela de tolerância) ou apenas recusa a segunda requisição mantendo a sessão?
- Ou o Keycloak considera o reuso como roubo de credencial e **derruba a sessão inteira**?

---

## 2. Resultado experimental observado

```
1. Login inicial da Ana realizado com sucesso via PKCE.
2. Disparando 2 renovações simultâneas (Promise.all) com o mesmo refresh token:
   - Requisição A: HTTP 200 (sucesso, emitiu novo access_token e refresh_token)
   - Requisição B: HTTP 400 (invalid_grant: "Maximum allowed refresh token reuse exceeded")
3. Verificação da sessão imediatamente após:
   - GET /userinfo com o access_token recém-emitido na Requisição A: HTTP 401
   - POST /token com o novo refresh_token da Requisição A: HTTP 400 (invalid_grant: "Session doesn't have required client")
```

---

## 3. Conclusão e impacto arquitetural

1. **O Keycloak revoga a sessão inteira** quando um refresh token é reutilizado além do limite (`refreshTokenMaxReuse = 0`). Ele não apenas rejeita a segunda chamada, mas **invalida retroativamente** a sessão e os novos tokens gerados pela primeira chamada.
2. **Impacto no BFF / Shell (ADR-0013):**
   - O **lock distribuído de renovação no Redis** NÃO é uma mera otimização de tráfego de rede; é um **requisito crítico de disponibilidade da sessão**.
   - Se duas requisições simultâneas chegarem ao shell com o token perto do vencimento:
     - Uma requisição deve adquirir o lock e realizar a renovação no Keycloak.
     - A segunda requisição **deve aguardar no lock** e consumir o novo token já renovado gravado na sessão do Redis, **nunca** enviando um segundo refresh request ao Keycloak com o token antigo.
