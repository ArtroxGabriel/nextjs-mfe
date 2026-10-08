# Handoff auditor_e3e5_4 (final)

Iteração 5 do gate E3-E5 (só auditor, depois de veto só por teste). Principal 1ba77e5, correção 92c6159.

**Veredito: VETO (só por teste).** 10 mutações, 8 pegas, 2 vivas: 1 de boa-fé sem teste (P4), 1 equivalente (P6). SKIP e FRAGIL são conferências sem mutação.
Nenhum defeito de produto: o código atual faz o certo; falta o teste que o prende. Detalhe por mutação em `mutacoes.txt`.

## 1. Correção só de teste
`git diff 46f558f 92c6159 --stat`: só `base/scripts/zona-demo.test.mjs` (+13 -2).

## 2. Vetos anteriores
- M1 (`voltar()` sem subir a zona): PEGA por ZD6 e ZD8 (ECONNREFUSED 127.0.0.1:3009 em `responde()`).
- M9 (laço sem `no_ar = !no_ar`): PEGA por ZD8 (prazo esgotado esperando "Zona de volta").

## 3. Mutações novas
- **P4 (veto)**: `voltar()` sem o `id` (`subirZonaDeTeste({ porta, hosts })`; o padrão do apoio é `zona9`). Arnês com a gestão falsa no comportamento do stub (`servidor.mjs:168`: DELETE de zona ausente = 404), Enter, Enter, Ctrl-C: o script manda `DELETE /v2/zonas/zona9/rota Bearer svc.zona9`, recebe 404 (tolerado), diz "Rota removida", sai 0, e a rota `demo` fica órfã no mapa. Sem mutação: `DELETE /v2/zonas/demo/rota svc.demo`, mapa vazio. Quebra o passo 4 do roteiro. ZD5 confere caminho e credencial do DELETE só sem `voltar`; ZD8 e ZD6 só contam os DELETE. Fora do D33 (lá: `kill -9` e a dica "Remova à mão").
- Equivalente: P6 (sem handlers de `uncaughtException`/`unhandledRejection`: depois que o laço começa nada lança fora de `try`).
- Pegas: P1 (derrubar sem `no_ar = false`), P2 (voltar sem `no_ar = true`; trava o arquivo até o timeout externo, como o N2), P3 (voltar na porta + 1), P7 (ErroDeUso sai 0), P9 (laço começa fora do ar), P10 (SIGINT sai 1).
- Testes novos não frágeis: sem sleep fixo (só prazos de 8 s e 2 s); filho morto em `finally`, ZD6 remove em `finally`; com a 3009 ocupada os 11 pulam com a mensagem em 0,21 s; 5 rodadas seguidas 11/11 em 1,5 s.

Correção sugerida (só teste): em ZD8, depois do segundo Enter e do SIGINT, conferir o DELETE como no ZD5 (`caminho` = `/v2/zonas/demo/rota`, `autorizacao` = `Bearer svc.demo`); em ZD6, o mesmo sobre o DELETE do `remover()` depois de `voltar()`. Pega P4.

## 4. Regressão por família (tudo revertido)
- `task test`: 20 + 286 + 26 + 83 + 161, todos verdes.
- `task verificar:estatica`: 52/52.
- `task scripts:test`: 40/40.
- `task verificar:redis` (showcase derrubado): 135/135.
- `task showcase:verificar` não rodado (a correção não toca a suíte do showcase nem código de app).

## Estado
- Árvore: só `m repos/erp-dominio-stub` e `m repos/erp-moldura` (lockfile, esperado). Nenhuma mutação deixada.
- Portas 3000-3003, 3009, 4001-4120 livres antes e no fim; Redis, Keycloak e Verdaccio no ar.
