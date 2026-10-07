# Handoff auditor_e3e5_1 (final)

Gate E3-E5, iteração 2. Principal b71f00a (código af8239c), shell d6e48fc. Detalhe por mutação em `mutacoes.txt`.

## Veredito: VETO (só por teste)

Nenhum defeito de produto no código atual. Cinco mutações de boa-fé sobrevivem a todas as verificações, e três delas
desfazem correções já aceitas (it.1 e Task 2 fix 1) sem que nada reprove: a correção não conta sem teste.

## Contagem
27 mutações de código (31 execuções, mais uma condição de ambiente, C1): 22 pegas (21 diretas, ZD5 indireta), 5 vivas.

## Vivas (todas de boa-fé e sem teste: motivo do veto)
| Id | Mutação | Teste que faltaria |
|---|---|---|
| ZD1 | `e?.code` vira `e?.codigo` no EADDRINUSE de `subirZonaDemo`: porta ocupada volta a dar stack crua (desfaz af8239c) | processo filho de `zona-demo.mjs` com a 3009 ocupada: saída 1, "já está em uso", sem linha `at ` |
| ZD2 | `registrar()` sem try/catch: gestão de acesso fora vira `TypeError: fetch failed` cru (desfaz af8239c) | filho com `ACESSO_URL` morto: saída 1, "não consegui falar", sem stack, 3009 fechada |
| ZD3 | ignora `registro >= 300`: registro recusado (403) e o script diz "Zona demo no ar, rota registrada", saída 0 | gestão de acesso falsa respondendo 403 ao POST: saída diferente de 0, sem "no ar" |
| ZD4 | `remover()` ignora o status do DELETE: 500 e "Rota removida", saída 0 (desfaz a Task 2 fix 1) | falsa com 500 no DELETE, entrada fechada ou SIGINT: saída 1 e "Não consegui remover" |
| ZD6 | `derrubar()` remove a rota (T2-M2 declarada no plano): F4 passa, o 503 vem do mapa ainda em memória no shell | em F4, depois de `demo.derrubar()`, `assert.ok((await idsDoMapa()).includes('demo'))`; ou o mesmo no teste de filho (Enter não manda DELETE) |

Os quatro primeiros e o ZD6 cabem num só arquivo de teste com processo filho e uma gestão de acesso falsa (o arnês usado
aqui está descrito em `mutacoes.txt`: POST/DELETE com status configurável, GET /v2/zonas), sem showcase, num glob que
não seja o de `base/verificacao/*.test.mjs` (ex.: `base/scripts/` ou `base/showcase/` com entrada no Taskfile). O mesmo
teste pega o ZD5 de forma direta (SIGINT tem de mandar DELETE), hoje pego só pela rodada seguinte da suíte.

## Pegas (resumo)
- Plano: T1-M1 (conferir e F1 no OIDC), T1-M2 (Redis e sessão no Redis), T1-M3 (linha do bloco), T2-M1 = ZD5 (indireta:
  F2 da rodada seguinte, "a rota demo já estava registrada"), T4-M1 (F3 e conferir), T4-M2 (F3, F5, F7), T4-M3 como S6
  (`proxy.ts` re-renderiza sem supportId: só F4 pega, as unidades do shell não), T4-M4 (F7 e conferir), M5 (F2 da rodada
  seguinte). Extras dos workers: IFM (F7), NAV2 (F5; F3 passa porque compara só hrefs).
- Novas: S1 a S5 no caminho da sonda (unidade "invariante 12" de `test/proxy.test.mjs`), S7 documento pelo caminho
  rápido (conferir, linha da origem interna; 4 unidades do shell), G1 suíte de volta ao glob da base (`verificar:redis`:
  136 testes, 1 fail), P3 e P4 (F6), B4b zona de acesso sem usuário na moldura (F5), F7tok (F7 no OIDC, 401).

## Limites e observações (não vetam)
- S1-e2e: F4 não distingue sonda de gateway. Logo depois de derrubar, o 503 vem do gateway (motivo=conexao); com a página
  da sonda sem supportId, F4 passa. Quem pega é a unidade do shell.
- `after()` da suíte é rede de segurança: tirá-lo é equivalente no caminho normal (o `finally` limpa).
- Mutações em `modoDeLogin`/`entrarComo` além da T1-M1 (troca de host por origem, fallback 'dev', ignorar `de`) são
  equivalentes no showcase: o login falha logo depois, com mensagem diferente.
- BAIXA (produto, ferramenta): no código atual, registro recusado pela gestão de acesso sai com stack crua
  (`throw new Error`, não `ErroDeUso`), a mesma classe do item do it.1.

## Regressão por família (tudo revertido)
- `task test`: 20, 286, 26, 83, 161, todos pass.
- `task verificar:estatica`: 52/52. `task scripts:test`: 29/29.
- `task verificar:redis` (showcase derrubado): 135/135, nenhuma suíte do showcase.
- `task showcase:verificar`: dev 7/7 em 92 s; OIDC 7/7 em 93 s; `conferir` sai 0 nos dois modos.

## Estado final
Árvores limpas (só `m repos/erp-dominio-stub` e `m repos/erp-moldura` pelo lockfile, esperado). `task showcase:dados:resetar`
rodado. Portas 3000-3009 e 4000-4129 livres, nenhum processo do showcase; Redis, Keycloak e Verdaccio no ar.
