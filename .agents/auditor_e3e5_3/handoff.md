# Handoff auditor_e3e5_3 (final)

Iteração 4 do gate E3-E5 (só auditor, depois de veto só por teste). Principal 4e00e96, correção c8b492a.

**Veredito: VETO (só por teste).** 21 mutações, 12 pegas, 9 vivas: 2 de boa-fé sem teste (M1, M9, a mesma lacuna), 7 equivalentes ou limite. SKIP e TEMPO são conferências sem mutação.
Detalhe por mutação em `mutacoes.txt`.

## 1. Correção só de teste
`git diff 568b314 c8b492a --stat`: só `base/scripts/zona-demo.test.mjs` (+78 -18). Nenhum código de produto.

## 2. Vetos anteriores
- N1 pega por ZD9; N3 por ZD5 SIGTERM; N4 por ZD5 SIGHUP; N5 por ZD7; N6 por ZD8.
- ZD1 a ZD6 reaplicadas (todas, não só amostra): todas pegas; ZD6 agora também pelo laço do script (ZD8).
- Pulo com a 3009 ocupada: os 11 pulam com a mensagem, 0,19 s (frágil do auditor_e3e5_2 resolvido).
- Tempo do arquivo: 1,6 s; com o prazo de 8 s estourado (ZD3 mutado) o arquivo termina sem trava. Cada caso mata o filho em `finally`; ZD1 fecha o ocupante; ZD6 fecha a zona.

## 3. Mutações novas
- **M1 (veto)**: `voltar()` sem o `subirZonaDeTeste` (só `no_ar = true`). O script imprime "Zona de volta. Recarregue a página." e a 3009 dá ECONNREFUSED (arnês Enter, Enter, GET /demo/api/health; sem mutação: 200). Passo 3 do roteiro que o próprio comando imprime. ZD6 chama `voltar()` sem conferir nada; ZD8 só dá um Enter; o F4 do showcase não chama `voltar`.
- **M9 (veto, mesma lacuna)**: laço do Enter sem `no_ar = !no_ar`: todo Enter derruba, a zona nunca volta.
- Equivalentes: M2, M3, M4 (guardas que o script nunca exercita fora de ordem; fechar servidor já fechado não falha), M5 (dois Ctrl-C mandam dois DELETE, o segundo dá 404 tolerado), M8 (erro no Enter só imprime: o único alcançável é a 3009 tomada no voltar; o usuário tenta de novo ou dá Ctrl-C, nada órfão), M12 (hosts 0.0.0.0: a zona demo não tem credencial nem dado; observação).
- Limite: M15 (3xx no registro contaria como sucesso; a gestão não responde 3xx e o fetch usa redirect manual).
- Pega: M18 (remover sem await).

Correção sugerida (só teste): em ZD8, segundo Enter, esperar "Zona de volta" e conferir que a 3009 responde (GET /demo/api/health 200, ou `escutar(3009)` falhar com EADDRINUSE) antes do SIGINT; em ZD6, depois de `voltar()`, o mesmo GET. Pega M1 e M9.

## 4. Regressão por família (tudo revertido)
- `task test`: 20 + 286 + 26 + 83 + 161, todos verdes.
- `task verificar:estatica`: 52/52.
- `task scripts:test`: 40/40.
- `task verificar:redis` (showcase derrubado): 135/135.
- `task showcase:verificar` (dev, `node base/showcase/subir.mjs`): 7/7; showcase derrubado por SIGINT no PID.
- `task showcase:dados:resetar` no fim.

## Estado
- Árvore: só `m repos/erp-dominio-stub` e `m repos/erp-moldura` (pnpm-lock.yaml, esperado). Nenhuma mutação deixada.
- Portas 3000-3003, 3009, 4001-4120 livres; Redis, Keycloak e Verdaccio no ar.
