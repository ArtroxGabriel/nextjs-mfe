# Handoff auditor_d7_1 (final)

## Veredito: PASS

Estado sob teste: principal f330cb7; shell 45787f1. Mutações em `mutacoes.txt` (arquivo:linha, antes/depois, comando,
resultado). Scripts: `mutar.py` (unidade, restaura com `git checkout`), `e2e.py` (L9 com `CONSTRUIR=1`), listas `*.json`.

## Etapas (todas feitas)
1. Leitura: LEIA-PRIMEIRO, AMBIENTE, plano D7, handoffs do revisor_d7_1 e do challenger_d7_1.
2. Linha de base: shell `pnpm test` 114/114.
3. Unidade (`lib/configuracao.ts`, 26 mutações): 25 pegas, 1 viva (M6b).
   - Exigidas: padrão 10_000 (M2a–d: 9_999, 10_001, 30_000, 6_000), `<=` (M3a `<`, M3b `>=`, M3c removida, M3d
     comparação com 5_000 fixo) e teto 120_000 (M4a 120_001, M4b 119_999, M4c sem teto, M4d 60_000): todas pegas.
   - Variantes: padrão de ERP_DESTINO_TIMEOUT_MS (M5a–d) pegas; teto dele (M6a 60_001, M6c sem teto, M6d 120_000) pegas,
     **M6b 59_999 viva**; leitura de `process.env` no lugar de `env`/`undefined` (M7a–c) pegas; retorno trocado (M8a–c) pegas.
   - Deriva no núcleo (M9a padrão 5_000→8_000, M9b teto 60_000→120_000 em `erp-nucleo/src/interno/configuracao.ts`): pegas
     pelo teste de fixação `os timeouts do nucleo tem padrao e teto`, que porém não cita o shell.
4. Ponta a ponta (`next.config.ts`, L9 com CONSTRUIR=1): E1 linha removida (sem resposta, aborto em 16 s), E2 10_000 fixo
   (10018 ms), E4b env sem a variável (10018 ms), E6b proxyTimeout fora de `experimental` (16 s), E7 ×1000 (16 s), E8 variável
   errada (10015 ms): pegas pelo L9. E4 `lerTetoDaZona({})` e E6 topo sem cast: pegas antes, pelo build (TS2345, TS2353).
   **Vivas: E3 (`proxyTimeout: 6_000`) e E5 (`Number(process.env.ERP_ZONA_TETO_MS) || 10_000`).**
   O L9 discrimina: piso teto-500 (5,5 s) e limite teto+2 s (8 s) separam o teto de 6 s do padrão de 10 s e dos 30 s do Next;
   o filtro `ms >= 2000` descarta a sonda (< 1 s), e falha da sonda nas 3 tentativas reprova (não dá falso verde).
5. Regressão: shell 114/114; `task verificar` 119 = 115 pass + 4 skipped, 0 fail; `task verificar:redis` 119/119. L9 em 6106 e
   6135 ms.
6. Árvores: shell e núcleo limpos; principal só com o que já estava (docs do humano, ponteiros dominio-stub/moldura) mais
   esta pasta. Shell reconstruído no estado original (E0-restaurado e E0-restaurado-2: BUILD_ID mais novo que o
   next.config.ts restaurado, L9 passa). Portas 3000–3003 e 4001–4120 livres, nenhum processo node da base. Sem JWT na pasta.

## Mutações vivas e classificação (regra A2)
- **E3** `proxyTimeout: 6_000`: fixa o valor que o teste usa. Contorno deliberado → limite declarado (L9 testa um valor só).
- **E5** `Number(process.env.ERP_ZONA_TETO_MS) || 10_000`: o valor chega, mas a validação na subida (≤ destino, > 120 s,
  inválido) some, e nenhum teste liga o `next.config.ts` ao leitor validado. Seria preciso reescrever de propósito a linha
  e abandonar um leitor que já existe: contorno → limite declarado. Sugestão (não bloqueia): um teste estático
  `proxyTimeout: lerTetoDaZona()` no next.config.ts, ou um caso ponta a ponta com `ERP_ZONA_TETO_MS=5000` recusado
  (o challenger mediu isso à mão, out-t3-invalidos.txt).
- **M6b** teto de ERP_DESTINO_TIMEOUT_MS 60_000→59_999 no shell: falha só na fronteira (60000 vale no núcleo e derruba a
  subida do shell, com mensagem). Ninguém digita 59_999 por engano: limite declarado. O risco real é a deriva da cópia
  (Menor 2 do revisor); ela está parcialmente coberta, porque mudar o núcleo reprova o teste de fixação dele (M9a/M9b).
  Quem ajustar esse teste também tem de mudar o shell, e nada avisa disso.

Nenhuma mutação viva é defeito plausível de boa-fé: sem veto.
