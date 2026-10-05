# Relatório worker_d2_2 (final)

Correção do veto da iteração 2 do gate do D2 (auditor_d2_2). Só testes: produto e versão do núcleo (0.10.2) intactos.

## Linha de base
- Principal: `docs/README.md`, `docs/arquitetura/alvo.md` modificados e `docs/arquitetura/infraestrutura-alvo.md` novo
  (pré-existentes, não são meus). Submódulos erp-dominio-stub e erp-moldura com `pnpm-lock.yaml` local (pré-existentes).
- erp-nucleo em `aeae3af`, erp-shell em `bce8f59`, limpos.

## Itens
1. **Estrutural** (`repos/erp-nucleo/test/apoio-transacao.mjs`, `comSorteiosRegistrados` + `conferirQuatroSorteios`):
   troca `crypto.randomBytes` por um registrador (bytes reais, anota tamanho e bytes de cada sorteio) e propaga com
   `syncBuiltinESMExports`, restaurando no `finally`. Confere que `id`, `state`, `codeVerifier` e `nonce` são cada um
   exatamente a codificação base64url de um sorteio de >= 32 bytes, e de sorteios distintos. Aplicado em
   `novaTransacao` direto (e exatamente 4 sorteios), em `identidadeDev().iniciar` e em `identidadeOidc().iniciar`
   (discovery feito antes da medição). Sem mudança no produto: `aleatorio()` usa `randomBytes(32)`.
2. **Comportamental** (`conferirSegredosForaDoPublico`): para `id` e `codeVerifier`, contra `state`, `nonce` e todo
   parâmetro da URL de autorização: o público não contém o segredo; o segredo não contém o público (só para valor
   público de 16+ caracteres, para não falhar por acaso com `code`/`S256`); o segredo não é sha256 nem sha512 do
   público em base64url, base64 ou hex. Chamado no teste do `identidadeDev` e no teste do id do `identidadeOidc`.
3. **T3o**: novo teste no `identidade-oidc.test.mjs`, duas chamadas a `iniciar`, os quatro valores e a URL mudam.
4. **P04b**: em `repos/erp-shell/test/proxy-renovacao.test.mjs`, os testes "paginas do shell" e "pagina do shell com
   sessao revogada" rodam para `['/', '/preferencias']` (`/preferencias` cai no ramo 4: nem pública nem de zona).

## Prova por mutação
Script: `.agents/worker_d2_2/mutar.py` (trecho de cada mutação igual a `.agents/auditor_d2_2/mutacoes.txt`; restaura
escrevendo o arquivo de novo e com `os.utime`, mtime novo; `git diff` da fonte vazio depois). Saída bruta em
`.agents/worker_d2_2/mutacoes.out` (a primeira rodada de T3o saiu com erro de sintaxe por defeito do meu script, sem o `return {`; foi descartada e refeita com o trecho exato).

| Mutação | Comando | Antes (auditor) | Agora |
|---|---|---|---|
| L04h `id = sha256(state)` | `pnpm test` (núcleo) | sobrevive 226/226 | **PEGA** 226/230, 4 falhas |
| L04k `id = state + '.login'` | `pnpm test` (núcleo) | sobrevive | **PEGA** 226/230, 4 falhas |
| L04j `codeVerifier = sha256(state)` | `pnpm test` (núcleo) | sobrevive | **PEGA** 226/230, 4 falhas |
| L04i `state = sha256(id)` (bônus) | `pnpm test` (núcleo) | sobrevive (equivalente) | **PEGA** 227/230, 3 falhas (só os estruturais) |
| T3o valores constantes | `tsc && node --test test/identidade-oidc.test.mjs` | sobrevive 28/28 | **PEGA** 28/30, 2 falhas (estrutural e "mudam a cada chamada") |
| P04b renova só em `/` | `pnpm test` (shell) | sobrevive 86/86 | **PEGA** 86/90, 4 falhas (`/preferencias`, memória e redis falso) |

Em L04h/k/j falham, cada um sozinho: o estrutural do núcleo, o do `identidadeDev`, o do `identidadeOidc` e o
comportamental do id do `identidadeOidc` (o comportamental pega as três sem o estrutural).

**L04h no ponta a ponta contra o `dist` do shell (E16h): não rodado.** O ponta a ponta não observa o id nem o state
da transação (E16h sobreviveu 5/5 com o auditor), e os testes novos são do núcleo, que é o dono e pega na fonte;
rodar de novo daria o mesmo resultado sem prova nova. Não é barato (Keycloak + `CONSTRUIR=1`, ~90 s) nem informativo.

## Verificações (depois de restaurar; `pnpm test` do núcleo reconstruiu o `dist` limpo)
- `cd repos/erp-nucleo && pnpm test`: 230/230.
- `cd repos/erp-shell && pnpm test`: 90/90.
- `task verificar:estatica`: rc=0, 51/51.
- `task scripts:test`: 21/21.
- Portas 3000–3003 e 4001–4120: nada escutando (nada foi subido).

## Commits
- erp-nucleo `83b00e0` test(identity): login transaction values are four independent random draws of 32 bytes or more (push feito).
- erp-shell `3034f76` test(proxy): shell page renewal covers a second shell path besides / (push feito).
- Principal: ponteiros dos dois submódulos e esta pasta.
