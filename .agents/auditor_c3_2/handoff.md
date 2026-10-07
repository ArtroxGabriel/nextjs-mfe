# Handoff auditor_c3_2 (final)

Iteração 2 do gate do C3, só de auditor. Correção auditada: shell `0081185..d52b5fc`.

**Veredito: PASS.** A correção mudou só teste e pega N06 e N13. Nenhuma das 21 mutações deixou defeito de produto vivo; as 4 vivas são equivalentes no comportamento observável.

## Etapas
1. [x] Correção só de teste: `git diff --stat 0081185..d52b5fc` no shell mostra só `test/mapa-zonas.test.mjs` (+11) e `test/pagina-erro-zona.test.mjs` (+14, novo).
2. [x] M01 (N06 reaplicada) PEGA pelo teste de fronteira do prefixo estático; M02 (N13 reaplicada) PEGA pelo teste da página de erro.
3. [x] Variantes de boa-fé M03 a M21 (registro em `mutacoes.txt`).
4. [x] Regressão com o fonte limpo: shell 160/160, stub 83/83, `task scripts:test` 29/29, `task verificar:estatica` 52/52 (saída 0), `task verificar:redis` 135/135 (saída 0). O build do shell foi refeito pelo `verificar:redis` depois de todas as reversões (`.next/BUILD_ID` de 16:22).

## Mutações
21 no total: 17 pegas, 4 vivas.

Vivas, com a classificação:
- M05 (prefixo estático comparado antes do normal em `encontrar`): equivalente. Com a fronteira de segmento nos dois testes e o id terminado em `-static` recusado, um caminho casa no máximo uma zona, então a ordem não muda o resultado.
- M09 (`encontrar` devolve a última zona que casa): equivalente, pelo mesmo motivo de M05.
- M19 (`caminhoNaZona` testa o prefixo normal antes do estático): equivalente. `/zona1-static/...` não começa com `/zona1/` nem é igual a `/zona1`.
- M17 (`supportId` validado contra o id da zona, erro de copiar e colar): equivalente hoje. Todo chamador (`gateway-zona.ts` linhas 63 e 185, `decisao-proxy.ts` linha 133) passa `randomUUID()`, que sempre passa no `SEGURO`; não há `supportId` hostil alcançável. Reforço opcional, não exigido: um caso com id válido e `supportId` hostil no `test/pagina-erro-zona.test.mjs`.

## Estado das árvores
Todas as mutações revertidas por `git checkout`. Repositórios limpos, exceto os `pnpm-lock.yaml` de `repos/erp-dominio-stub` e `repos/erp-moldura` (já modificados antes, de propósito). Portas 3000 a 3003 e 4001 a 4120 livres ao fim. Nenhum commit, nenhum token ou cookie gravado.
