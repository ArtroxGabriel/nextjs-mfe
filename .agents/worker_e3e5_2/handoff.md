# Handoff worker_e3e5_2 (final)

Veto só por teste do auditor_e3e5_1 (gate E3-E5, it.2) corrigido; só testes mudaram.

- `base/scripts/zona-demo.test.mjs` (novo, roda em `task scripts:test`): gestão de acesso falsa em `node:http` (porta 0) e
  `zona-demo.mjs` como filho. Casos ZD1 a ZD6. Pula com mensagem se a 3009 estiver ocupada.
- `base/verificacao/showcase/showcase.test.mjs` F4: depois de `derrubar()`, `demo` continua em `GET /v2/zonas`.

| Mutação | Reprovou |
|---|---|
| ZD1 `e?.codigo` | ZD1 |
| ZD2 registrar sem try/catch | ZD2 |
| ZD3 ignora registro >= 300 | ZD3 |
| ZD4 remover ignora status | ZD4 e ZD6 |
| ZD5 sair sem remover | ZD5 e ZD4 |
| ZD6 derrubar remove a rota | ZD6 (scripts:test) e F4 (showcase:verificar) |

`scripts:test` sem mutação: 35/35. `showcase:verificar` sem mutação: 7/7. `zona-demo.mjs` revertido (git diff vazio).
Limite conhecido (D33): 403 no registro ainda sai com stack crua; ZD3 não assevera isso.
