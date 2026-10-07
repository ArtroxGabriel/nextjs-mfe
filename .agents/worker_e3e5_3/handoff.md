# Handoff worker_e3e5_3 (final)

Veto da iteração 3 corrigido, só testes (`base/scripts/zona-demo.test.mjs`): ZD5 para SIGINT/SIGTERM/SIGHUP, ZD7 fim da
entrada, ZD8 Enter mantém a rota, ZD9 DELETE 404 tolerado; pulo por `t.skip` dentro de cada teste (com a 3009 ocupada: 11
pulados); timers limpos; `outra` do ZD6 em finally.

| Mutação | Reprovou |
|---|---|
| N1 | ZD9 |
| N3 | ZD5 SIGTERM |
| N4 | ZD5 SIGHUP |
| N5 | ZD7 |
| N6 | ZD8 |
| ZD1 a ZD6 | ZD1, ZD2, ZD3, ZD4+ZD6, ZD5(x3)+ZD4+ZD7+ZD8, ZD6+ZD8 |

`scripts:test`: 40/40 em cerca de 1,8 s. `base/showcase/` sem diff.
