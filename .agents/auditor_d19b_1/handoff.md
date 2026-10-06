# Handoff auditor_d19b_1 (final)

**Veredito: VETO.** Uma lacuna de teste para erro plausível de boa-fé no que a D19-B entrega (A10): erro do store
durante a espera do perdedor virar `ausente`, que desloga com a sessão intacta. Todo o resto é pego ou equivalente.

Gate D19-B, iteração 1. Linha de base (2026-10-06): núcleo `fdea296` (0.10.3), shell `72ecc2f`, zona-1 `860a176`,
zona-2 `5a665a7`, zona-acesso `4ea036d`; submódulos limpos, salvo os `pnpm-lock.yaml` conhecidos de stub e moldura;
`dist` do @erp/nucleo nas 4 apps = tarball 0.10.3 do Verdaccio (`diff -r`); núcleo 262/262, shell 102/102.

Método: `mut.py` (scratchpad) troca um trecho único, roda a suíte, restaura o conteúdo (com o mtime original quando não
houve build) e grava em `mutacoes.txt` o trecho exato antes/depois e os testes que reprovaram. Suítes: `pnpm test` do
núcleo e do shell; `node --test --test-name-pattern` em `base/verificacao/base.test.mjs` (P12, V1 estático, sem subir
a base); `task scripts:test`; `CONSTRUIR=1 task verificar:oidc` (ponta a ponta, mutação no `dist` instalado no shell, com
`touch` em `lib/nucleo.ts` antes e depois para forçar o build).

## Contagem
96 registros em `mutacoes.txt`: **81 pegos, 15 vivos** (10 equivalentes, 2 observações sem veto, 3 da lacuna do veto:
A10, que é da D19-B, e A10c e A10d, a mesma lacuna em código do D2). Inclui a sonda A10s (fora da suíte) e a E02.

| Família | Pegas | Vivas |
|---|---|---|
| A espera do perdedor (só com token vencido, teto, passo, releitura, estados, erro) | A01 A02 A03 A04 A04b A04c A05 A05b A05d A06 A06b A07 A09 A11 A12 (15), mais a sonda A10s | A04d A07b A08 A10b A13 (equivalentes), A05c (observação), **A10**, A10c, A10d |
| B configuração e D20 (espera, passo, lock x timeout, janela x vida, `lerInteiroEntre`, `urlRetorno`, `expiraEm`) | B01–B06 B08 B09 B12–B26 (23) | B07 B10 (equivalentes), B11 (observação) |
| C log sem segredo (núcleo e shell) | C01–C06 (6) | — |
| D shell (Max-Age de `expiraEm`, esquema do `sair`, `trim` em SHELL_HOSTS, `server-only` em cookies.ts, fiação do registrador, erro vira prosseguir) | D01–D04 D06–D15, A10e (15) | D05 (equivalente) |
| Z zonas (SHELL_HOSTS com `trim` nas 3 zonas, P12) | Z01–Z07 (7) | — |
| R regressão do D2 (uso único, segredos independentes, SET NX PX, ACL, `sair` mesma origem, revogada, releitura depois do lock) | R01 R03–R11 (10) | R02 R02b (equivalentes) |
| S lista de inclusão e LIDAS_SO_NO_SHELL | S01 S02 (2) | — |
| E ponta a ponta, regressão à 0.10.2 | E01, E02 (2) | — |

Destaques:
- **E01** (o `renovarSessao` da 0.10.2 no `dist` do shell, perdedor sem espera): `verificar:oidc` reprova no teste novo,
  `status do lote: 200 200 307 200 307 200 307 200 307 200`. **E02** (o `dist` inteiro da 0.10.2 no shell): o build do
  shell recusa (`expiraEm` e `registrarFalha` não existem nos tipos); pega pelo typecheck, não pelo comportamento.
- A04 (espera sem teto) é pega, mas a suíte do núcleo pendura cerca de 10 min: o laço vazado segura o processo depois
  do timeout de 10 s do teste. Não é veto; vale saber se uma mutação parecida aparecer de novo.
- Equivalentes e observações, um a um, com o motivo: no fim de `mutacoes.txt`.

## Veto
**A10**: em `esperarRenovacao` (`repos/erp-nucleo/src/fabricas/criarNucleo.ts`), trocar
`const s = await valida(id)` por `const s = await valida(id).catch(() => null)` passa as 262 unidades do núcleo, as 102
do shell e as ponta a ponta. Com a mutação, um tropeço do Redis durante a espera devolve `ausente`; o proxy
(`decisao-proxy.ts`) apaga o cookie e manda a navegação ao login com a sessão intacta no store, o sintoma do D19.
Contraria o contrato escrito no próprio `decisao-proxy.ts` ("Erro (IdP ou store fora): a sessão fica e a requisição
segue"). É um erro plausível de boa-fé (um `catch` defensivo) e o despacho pedia exatamente "tratamento de erro na
espera (vira prosseguir)". A sonda `sonda-erro-na-espera.test.mjs.txt` (nesta pasta, rodada fora do repositório) passa
no produto e reprova com A10 (A10s).

A mesma lacuna existe nas duas leituras de `renovarSessao` que vêm do D2 (A10c: antes do lock; A10d: com o lock na
mão). Um teste só, parametrizado pelo momento da falha, cobre as três.

**Testes que faltam** (`repos/erp-nucleo/test/identidade.test.mjs`, nos três stores como os da espera):
1. Token vencido, lock com outro dono, o leitor do store lança durante a espera: `renovarSessao` rejeita (não devolve
   `ausente` nem `revogada`) e a sessão continua no store. Pega A10.
2. O mesmo com a falha na leitura de antes do lock e na releitura com o lock na mão. Pega A10c e A10d.
3. Recomendado, no shell (`test/proxy-renovacao.test.mjs`): store que lança dentro de `renovarSessao` com o token vencido
   leva a `prosseguir` sem `limparSessao`. Hoje só o erro do IdP exercita esse caminho (D14 e A10e pegam por ele).

Sem veto (registrar, se quiserem): B11 (`ERP_RENOVACAO_ESPERA_MS=''` deixaria de virar o padrão sem nenhum teste
reprovar; falha fechada e alta, sem promessa em `CONFIGURACAO.md`; `lerNumeroPositivo` tem esse teste e
`lerInteiroEntre` não). A05c (passo dobrado só muda a latência).

## Estado ao fim (conferido)
- Fontes nos HEADs: `git status` limpo em todos os submódulos, salvo os `pnpm-lock.yaml` conhecidos de erp-dominio-stub e
  erp-moldura (não tocados). Nenhum arquivo criado em `src/`. As builds das zonas não foram refeitas (as mutações das zonas
  foram estáticas e restauradas com o mtime original).
- `dist` do @erp/nucleo nas 4 apps = tarball 0.10.3 (`diff -r`); `repos/erp-nucleo/dist` reconstruído do fonte limpo.
- Núcleo `pnpm test` 262/262; shell `pnpm test` 102/102; `CONSTRUIR=1 task verificar:redis` 118/118 (shell reconstruído
  com o dist 0.10.3, BUILD_ID 14:50); `CONSTRUIR=1 task verificar:oidc` 6/6; `task showcase:checar` rc=0 (vida do token
  devolvida ao padrão).
- Portas 3000–3003 e 4001–4120 livres; nenhum processo `next` vivo. `grep -rlE 'eyJ[A-Za-z0-9_-]{10,}\.eyJ'` nesta pasta: vazio.
- Arquivos: `handoff.md`, `mutacoes.txt`, `sonda-erro-na-espera.test.mjs.txt`. Logs brutos de cada mutação ficaram no
  scratchpad (não versionados).
