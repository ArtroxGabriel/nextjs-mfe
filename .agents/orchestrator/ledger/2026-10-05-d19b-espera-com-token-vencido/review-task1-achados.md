# Revisão Task 1 D19-B (final)

**Veredito: APROVADO.** Nenhum achado Critical ou Important.

## Critical
Nenhum.

## Important
Nenhum.

## Minor
1. `repos/erp-nucleo/test/identidade.test.mjs` (lista de recusados, ~linha 650): faltam `'1e3'`, `'0x10'` e `'+5'`. O código recusa os três (conferido com sonda em `dist/`), mas nenhum teste trava isso.
2. `docs/CONFIGURACAO.md` (linhas 20-21): diz "núcleo ✅ (0.10.3)", e o pacote ainda está em 0.10.2 até a Task 3. Também não avisa que o padrão 2000 exige `ERP_RENOVACAO_LOCK_S` ≥ 3, nem que o passo só é comparado à espera quando ela está ligada.
3. `src/interno/configuracao.ts:29`: um valor acima do inteiro seguro cai na mensagem "no mínimo", que engana. É só cosmético.
4. `src/fabricas/criarNucleo.ts:195-201`: a espera não compara `s.sub` com `antes.sub`. Hoje nenhum caminho permite isso: `concluirLogin` cria um id novo e `regravar` só regrava com o mesmo `sub`. Um comentário bastaria.
5. Não há teste para "o vencedor recebe `revogada` (ou outro `sub`) e o perdedor volta `ausente`". A remoção já é coberta pelo teste da sessão encerrada.
6. `docs/adr/0013-*.md:28` ainda diz que quem perde "não espera". Fica até o adendo 3 da Task 4.
7. As releituras da espera não têm timeout próprio: um Redis travado estica a espera além do teto. Esse risco já existe nas outras leituras do store e não é desta task.

## Verificado sem problema
- **Desenho.**
  - A espera só acontece quando o lock é perdido **e** o token já venceu: `tokenVale(antes)` é medido depois da tentativa de lock.
  - A espera só usa `valida` (store) e nunca o IdP.
  - Devolve `ausente`, `em-dia` ou `em-andamento`.
  - Na janela, quem perde volta `em-andamento` na hora.
  - O tipo `EstadoDaRenovacao` não mudou.
- **Corridas.**
  - `tokenVale` usa `Date.now()` a cada releitura.
  - A sessão vencida durante a espera volta `ausente` (por `valida`).
  - O laço sempre termina: a pausa é de pelo menos 1 ms e `Date.now()` cresce.
  - Só devolve `em-andamento` com `Date.now() >= limite`, então o piso de 300 ms é garantido.
  - O proxy do shell trata `em-dia` como "prosseguir", e a página relê a sessão do store: o perdedor recebe o token novo.
- **Configuração.**
  - A validação acontece na criação: piso 0 (espera) e 10 (passo), teto de 300000 e `< lockMs`.
  - `0` desliga a espera sem ler o store.
  - `lerInteiroEntre` recusa `' '`, `'1e3'`, `'-1'`, `'0x10'`, `'+5'`, `'1.0'`, `' 5'`, `'5\n'` e dígito árabe (sonda).
  - As duas variáveis estão em `LIDAS_SO_NO_SHELL`, e `ambiente.test.mjs` passa 13/13.
  - O shell recebe o ambiente inteiro (`ambienteDoPapel('shell')` faz `{...base}`), então não há lista de inclusão do shell a mudar.
  - Os padrões e as regras em `CONFIGURACAO.md` batem com o código.
- **Testes.**
  - `pnpm test` dá 248/248.
  - `identidade.test.mjs` passou 12 vezes em paralelo, 53/53 em todas.
  - Os casos rodam nos três stores, e as margens são as do relatório: até 365 ms com passo 20 e até 525 ms com passo 100, contra 300-313 ms medidos.
  - As mutações M1 a M5 seriam pegas pelos testes descritos. Conferi a lógica de cada uma, sem rodar.
- **Invariantes.**
  - 1: `renovarSessao` e `esperarRenovacao` só devolvem strings de estado, e nenhum token sai da fábrica.
  - 3: `server-only` está nos dois arquivos.
  - 15: tudo fica em `criarNucleoDoShell`, que só `/shell` exporta.
