# Handoff auditor_e3e5_2 (final)

Gate E3-E5, iteração 3 (só auditor). Principal 6445097, correção 7e1730a. Detalhe por mutação em `mutacoes.txt`;
arnês em scratchpad (`aud/arnes.mjs`: zona-demo.mjs como filho contra uma falsa, casos SIGINT, SIGTERM, SIGHUP,
stdin-fim, enter, del404).

## Veredito: VETO (só por teste)

Nenhum defeito de produto. A correção é só de teste (`git diff c079582 7e1730a --stat`: `base/scripts/zona-demo.test.mjs`
novo e 2 linhas no F4) e pega as seis mutações do veto anterior. Mas variações de boa-fé da mesma família sobrevivem, e
uma delas (N4) desfaz parte da Task 2 fix 1 (1198ab1, "handles SIGHUP") sem que nada reprove: o mesmo motivo do veto
da iteração 2.

## Contagem
17 mutações de código (mais ZD6-F4 contra o showcase e a checagem do pulo): 8 pegas, 9 vivas (5 de boa-fé, 4 equivalentes).

## Mutações do veto anterior: todas pegas
| Id | Teste que pega |
|---|---|
| ZD1 `e?.codigo` | ZD1 (stack crua, sem "já está em uso") |
| ZD2 registrar sem try/catch | ZD2 (`TypeError: fetch failed` cru) |
| ZD3 ignora registro >= 300 | ZD3 (filho diz "rota registrada" e não sai: prazo de 8 s) |
| ZD4 remover ignora status | ZD4 e ZD6 |
| ZD5 sair sem remover | ZD5 e ZD4 (agora direta) |
| ZD6 derrubar remove a rota | ZD6 (scripts:test) e F4 no showcase dev ("depois de derrubar, a rota demo deveria continuar no mapa") |

## Vivas de boa-fé (motivo do veto)
| Id | Mutação | Efeito observado (arnês) | Teste que faltaria |
|---|---|---|---|
| N4 | sem o handler de SIGHUP (adicionado em 1198ab1) | fechar o terminal mata sem DELETE: rota órfã | ZD5 parametrizado por SIGINT, SIGTERM e SIGHUP |
| N3 | SIGTERM vira `process.exit(0)` sem `sair()` | sai 0 sem DELETE: rota órfã | idem |
| N5 | entrada fechada: `process.exit(0)` no lugar de `await sair(0)` | sai 0 sem DELETE: rota órfã | filho com `p.stdin.end()`: DELETE e saída 0 |
| N6 | Enter chama `demo.remover()` no lugar de `demo.derrubar()` | o Enter manda DELETE (passo 2 do roteiro diz "rota mantida") | filho: escreve "\n", espera "derrubada", nenhum DELETE; o ZD6 atual só cobre a função |
| N1 | DELETE 404 deixa de ser tolerado (tolerância de 1198ab1) | rota já ausente e Ctrl-C sai 1 com "Não consegui remover" | falsa com DELETE 404 e SIGINT: saída 0, "Rota removida" |

Todos cabem no mesmo `base/scripts/zona-demo.test.mjs`, com a falsa e o `filho()` que já existem.

## Vivas equivalentes (não vetam)
- N8 fechar antes do DELETE: `fechar` não falha nem trava e o shell roteia pelo mapa em memória até o TTL nos dois casos.
- N11, N12 sem `zona.fechar()` antes do erro de registro: no script o processo sai e libera a 3009; nenhum chamador usa a
  função como biblioteca com a gestão de acesso fora.
- N14 `principal` engole qualquer erro: imprime só a mensagem e sai 1 (melhora).

## Fragilidade dos testes novos (corrigir junto)
- **O pulo não funciona.** `{ skip: pular() }` é avaliado na definição, antes do `before()`; com a 3009 ocupada os 6 casos
  falham com `TypeError: Cannot read properties of null (reading 'address')`. Não esconde falha (falha fechado), mas a
  mensagem prometida não aparece. Trocar por `t.skip(...)` dentro de cada teste, ou checar a porta no topo do módulo.
- O arquivo leva ~8,7 s para 0,7 s de testes: o `setTimeout` de `esperarSaida` (e de `ate`) não é limpo e segura o
  processo até o PRAZO_MS. Sem sleep fixo; esperas por evento com prazo.
- Limpeza em `finally` em ZD1 a ZD6, salvo a segunda metade do ZD6 (`outra`), sem efeito prático hoje. N2 (remover não
  fecha) trava o arquivo até timeout externo: servidor vazado no processo do teste, inerente à mutação.
- Passam pelo motivo certo: cada viva/pega conferida pela mensagem de falha (ver mutacoes.txt).

## Regressão por família (tudo revertido)
- `task test`: 20, 286, 26, 83, 161, todos pass.
- `task verificar:estatica`: 52/52. `task scripts:test`: 35/35.
- `task verificar:redis` (showcase derrubado): 135/135.
- `task showcase:verificar`: dev 7/7 em 92 s (F4: 503 em 8 ms); OIDC 7/7 em 93 s (F4: 503 em 8 ms).

## Estado final
`zona-demo.mjs` revertido (git diff vazio em base/). Árvores: só `m repos/erp-dominio-stub` e `m repos/erp-moldura`
(lockfile, esperado). Mapa de zonas sem `demo` depois do ZD6-F4. `task showcase:dados:resetar` rodado. Portas 3000-3009 e
4000-4129 livres, nenhum processo do showcase; Redis, Keycloak e Verdaccio no ar.
