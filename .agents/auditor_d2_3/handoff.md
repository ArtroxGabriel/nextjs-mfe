# Handoff auditor_d2_3 (final)

**Veredito: PASS.** 55 mutações e sondas, 55 pegas, 0 sobreviventes; nenhuma sobrevivente de boa-fé, nenhum teste faltando.

Gate D2, iteração 3. Linha de base: núcleo `83b00e0`, shell `3034f76`, demais submódulos limpos (stub e moldura com
`pnpm-lock.yaml` local, pré-existente); `dist` do núcleo nas 4 apps = tarball 0.10.2 (`diff -r`). Mutações por
`mut.py` (scratchpad): troca de texto único, restauração escrevendo o arquivo de novo (mtime novo); trecho exato em
`mutacoes.txt`.

## Lote 1: veto da iteração 2 — 6/6 pegas
L04h, L04k, L04j (4 falhas cada: estrutural do núcleo, do `identidadeDev`, do `identidadeOidc` e comportamental do id),
L04i (3, só estruturais), T3o (2 de 30, só o arquivo do `identidadeOidc`), P04b (4 de 90, `/preferencias`).

## Lote 2: variantes do estrutural — 19/19 pegas; dentes do apoio — 4/4
- V01 `randomUUID`, V01b dois `randomUUID` sem hífen (64 hex, passa no tamanho; só os 3 estruturais pegam), V01o só no arquivo OIDC (1 falha).
- V02 16 bytes em tudo, V02b só o id com 16 bytes, V02c dois sorteios de 16 bytes em hex (só estruturais), V02d metade repetida.
- V03 mesmo sorteio em id e code_verifier (invertido), V03b id base64url e state hex do mesmo sorteio (o state publica o id;
  só os estruturais pegam: o comportamental não vê troca de codificação), V03c id base64 e nonce base64url.
- V04 state = id invertido, V04b state = sha1(id) hex + sufixo (fora da lista do comportamental; estruturais pegam), L04i.
- V05 nonce constante, V05b nonce sorteado uma vez no carregamento, V05o idem só no arquivo OIDC (2 falhas).
- V06 um sorteio de 129 bytes fatiado em 4 textos de 43, V06b 128 bytes fatiados em 4 buffers de 32 (só estruturais).
- V07 o adaptador OIDC sobrescreve o id com sha256(state) depois de `novaTransacao`; V07b o dev sobrescreve o code_verifier.
- Dentes: TS1 troca desligada, TS2 registrador que não anota, TS3 sem `syncBuiltinESMExports`: os 3 estruturais reprovam com
  o produto limpo (não passam à toa). TS4 (tamanho anotado fixo em 32, com 16 bytes no produto): o piso de 32 do estrutural
  cai, mas os testes de tamanho >= 43 pegam.
- Nota (sem veto): V01b e V06b são implementações seguras recusadas; o teste é mais estrito que o necessário e falha alto.

## Lote 3: restauração da troca
Sonda temporária (`sonda-restauracao.test.mjs.txt`, rodada em `test/` e removida): falha forçada síncrona, assíncrona e na
conferência; nos três o teste seguinte vê `crypto.randomBytes` e o import nomeado iguais à original. Dentes da sonda: RS1 (finally
sem restaurar), RS2 (sem `syncBuiltinESMExports` na volta), RS3 (restauração fora do finally) fazem R1–R3 reprovarem.
Achado sem veto: com **timeout** do `node:test` e `fn` pendurada, o `finally` nunca roda e a troca fica para os testes seguintes do
arquivo (R4 reprova). Benigno: o registrador devolve bytes reais da original; não gera aprovação falsa nem falha falsa.

## Lote 4: regressão, uma por família — 22/22 pegas
P05, P03, F04b, F05, F01 (fronteira), F08 (estática), L07, L01, T4, O09, H04, C03, R04, A03, N05, S05, K01, Z01, Y01, J26, B01,
G02. Dados do stub iguais antes e depois.

## Lote 5: ponta a ponta
E09 (P04 no shell, `CONSTRUIR=1 task verificar:oidc`): pega, 4/5 (renovação vencida em página de zona e o teste do modo OIDC).

## Contagem
Lote 1: 6/6 · lote 2: 19 variantes + 4 dentes = 23/23 · lote 3: 3 dentes da sonda (mais a sonda: 3 de 3 restaurações após falha;
timeout fica, benigno) · lote 4: 22/22 · lote 5: 1/1. Total no `mutacoes.txt`: 55 PEGA, 0 SOBREVIVE.

## Sobreviventes
Nenhuma. Observações sem veto: (1) o estrutural recusa implementações seguras (V01b, V06b): mais estrito que o necessário, falha
alto, não aceita nada à toa; (2) com timeout do `node:test` a troca de `randomBytes` não é desfeita (benigno, ver lote 3).

## Estado ao fim
- Fontes: submódulos nos HEADs (núcleo `83b00e0`, shell `3034f76`), `git status` limpo salvo os `pnpm-lock.yaml` pré-existentes
  de stub e moldura; sonda temporária fora de `test/` (guardada aqui como `.txt`); dados do stub iguais.
- `dist` do @erp/nucleo nas 4 apps = tarball 0.10.2 (`diff -r`); `repos/erp-nucleo/dist` reconstruído limpo pelo `task test`.
- `task test` rc=0 (contratos 20, núcleo 230, moldura 26, stub 75, shell 90; todos fail 0); `CONSTRUIR=1 task verificar:oidc` 5/5
  (shell reconstruído depois da restauração do E09); `task verificar:redis` 118/118.
- Keycloak no padrão (`task showcase:checar` rc=0). Portas 3000–3003 e 4001–4120 livres; nenhum processo node vivo. Sem JWT nesta
  pasta nem nos logs.
