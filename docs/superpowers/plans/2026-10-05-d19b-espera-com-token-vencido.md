# D19-B: perdedor do lock espera a renovação quando o token já venceu

> **Para agentes:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, task por
> task. Passos com `- [ ]`. Começa **depois do gate do D2**.

**Objetivo:** fechar o D19 com a opção B escolhida pelo humano em 2026-10-05. Com o token **já vencido**, quem perde o lock
de renovação espera o vencedor (até um teto configurável) e relê a sessão, em vez de seguir com o token morto e cair no
`/login`. Com o token ainda válido (na janela), nada muda: quem perde não espera. Junto vêm os itens do D20, que pedem a
mesma versão do núcleo, e os menores do gate do D2.

**Evidência do problema:** `challenger_d2_1` e `challenger_d2_2`, com token vencido e 10 requisições concorrentes, viram
1 renovação, 1 resposta 200 e 9 respostas 307 para `/login`, com a sessão intacta no Redis (`DEFERRED.md` D19).

**Decisões do humano:** D19 → B (2026-10-05). Instalação nenhuma.

## Restrições

- Invariantes do `AGENTS.md`, em especial 1, 3, 13 e 15. A renovação só existe em `@erp/nucleo/shell`.
- Tempo de espera e passo de releitura são **configuração** (`docs/CONFIGURACAO.md`), com padrão seguro e teto validado na
  criação, como `ERP_RENOVACAO_JANELA_S` e `ERP_RENOVACAO_LOCK_S`.
- Núcleo **0.10.3**, lockstep nas 4 apps (`task lockstep`). Outra máquina: `task pacotes:publicar` e
  `task pacotes:alinhar-hashes`.
- A espera nunca chama o IdP: só relê a sessão no store. O refresh token continua sendo gasto uma vez só.

## Desenho

Em `renovarSessao` (`repos/erp-nucleo/src/fabricas/criarNucleo.ts`), no ramo `!adquirirLockRenovacao`:

```
se o token de `antes` ainda vale → 'em-andamento'          (como hoje: não espera)
senão, até ERP_RENOVACAO_ESPERA_MS, a cada ERP_RENOVACAO_ESPERA_PASSO_MS:
    s = valida(id)
    sem sessão           → 'ausente'
    token de s ainda vale → 'em-dia'                        (outro renovou)
fim do teto            → 'em-andamento'                     (como hoje: segue e o domínio decide)
```

- **Configuração nova:**
  - `ERP_RENOVACAO_ESPERA_MS`: padrão 2000, teto menor que `ERP_RENOVACAO_LOCK_S`×1000; `0` desliga a espera.
  - `ERP_RENOVACAO_ESPERA_PASSO_MS`: padrão 50, mínimo 10, menor que a espera.

  As duas são lidas só no shell e entram em `LIDAS_SO_NO_SHELL` e na lista de inclusão do shell.
- **Custo declarado:** com o IdP fora, o lock fica preso como backoff, e cada requisição com token vencido espera o teto antes
  de seguir para o login. A sessão continua no store e se recupera quando o IdP volta. Isso vai no adendo 3 do ADR-0013 e em
  `CONFIGURACAO.md`.
- O tipo `EstadoDaRenovacao` não muda: a espera devolve estados que já existem. O shell (`decisao-proxy.ts`) só precisa
  atualizar o comentário que hoje cita o D19.

## Tasks

### Task 1: espera do perdedor no núcleo 0.10.3 (D19-B)

**Arquivos:**
- `repos/erp-nucleo/src/fabricas/criarNucleo.ts`;
- `src/interno/configuracao.ts`;
- os testes em `repos/erp-nucleo/test/`.

- [ ] Ler e validar `ERP_RENOVACAO_ESPERA_MS` e `ERP_RENOVACAO_ESPERA_PASSO_MS` na criação de `criarNucleoDoShell`, com
  padrão, teto e recusa de valor inválido. Seguir o padrão de `lerNumeroPositivo` e de `ERP_RENOVACAO_LOCK_S`.
- [ ] Implementar a espera conforme o desenho.
- [ ] **Testes de unidade**, nos três stores (memória, arquivo e Redis falso com NX), com IdP falso de latência controlada:
  - com o token vencido, 20 chamadas concorrentes a `renovarSessao` fazem 1 chamada ao IdP, e todas terminam `renovada` ou
    `em-dia`, nunca `em-andamento`;
  - com o token na janela e ainda válido, os perdedores voltam `em-andamento` sem esperar (limite folgado, ex. < 200 ms);
  - com o IdP lançando erro transitório e o token vencido, os perdedores voltam `em-andamento` depois de no mínimo
    `ESPERA_MS` e no máximo `ESPERA_MS + 2×PASSO`, e o IdP é chamado uma vez;
  - sessão encerrada durante a espera dá `ausente`;
  - com `ERP_RENOVACAO_ESPERA_MS=0`, o comportamento é o de hoje;
  - valores inválidos e acima do teto são recusados na criação.
- [ ] Rodar as mutações e registrar no relatório, cada uma tem de ser pega:
  - não esperar com o token vencido;
  - esperar também com o token válido;
  - chamar o IdP durante a espera;
  - ignorar o teto.

### Task 2: itens do D20 no mesmo 0.10.3

**Arquivos:**
- `repos/erp-nucleo/src/fabricas/criarNucleo.ts`;
- `src/adaptadores/identidade-oidc.ts`;
- `src/portas/identidade.ts`;
- os testes.

- [ ] Validar `ERP_RENOVACAO_LOCK_S` > 2 × `ERP_DESTINO_TIMEOUT_MS`/1000 em `criarNucleoDoShell`, com recusa na criação.
- [ ] `ERP_RENOVACAO_JANELA_S` menor que metade da vida do token, conferido por sessão. Se violado, registrar no servidor
  e não renovar em laço. Escolher a forma mais simples que um teste prove.
- [ ] `urlRetorno` sem query nem fragmento: usar `validarUrl(..., true)` em `identidade-oidc.ts`, com teste.
- [ ] JSDoc da porta: `iniciar` e `concluir` lançam em erro transitório.
- [ ] `iniciarLogin` devolve `expiraEm`, para o shell não repetir padrão e teto de `ERP_LOGIN_TRANSACAO_S` (item 5 do D20).
  Se isso mudar a assinatura de forma incompatível, deixar para a Task 3 ajustar o shell.

### Task 3: publicar, lockstep e shell

**Arquivos:**
- `repos/erp-nucleo/package.json` (0.10.3);
- as 4 apps;
- `repos/erp-shell/lib/*`;
- `base/verificacao/oidc/oidc.test.mjs`.

- [ ] Núcleo 0.10.3: publicar no Verdaccio desta máquina, instalar nas 4 apps e conferir com `task lockstep`.
- [ ] Shell:
  - usar `expiraEm` de `iniciarLogin` (D20);
  - comentário de `decisao-proxy.ts` sobre o D19;
  - `import 'server-only'` em `lib/cookies.ts`;
  - `SHELL_HOSTS` com `trim`;
  - `sair` passa a comparar o esquema do `Origin` com o da requisição, além do host (menores do gate do D2);
  - testes de unidade para cada item.
- [ ] **Teste ponta a ponta novo** em `oidc.test.mjs`: com o token **vencido**, 10 requisições concorrentes a `/` e a uma
  página de zona respondem todas 200, com uma renovação só (`MONITOR` do Redis, como no teste da janela). Hoje esse teste
  reprova (1 resposta 200 e 9 respostas 307); depois da Task 1 tem de passar. Rodar a mutação "não esperar" contra o build e
  registrar que é pega.

### Task 4: documentos e menores do gate do D2

- [ ] Adendo 3 ao ADR-0013: a espera com o token vencido, o teto, o custo com o IdP fora e por que a janela continua sem
  espera.
- [ ] `docs/CONFIGURACAO.md`:
  - as duas variáveis novas;
  - as validações novas do D20;
  - corrigir o §5 ("valor inválido é erro na subida": a validação é na primeira requisição; dizer isso ou fazer valer).
- [ ] Contagem de testes no `README.md` §3 e no `docs/ROTEIRO-DE-VERIFICACAO.md`: hoje são 118. Preferir um texto que não
  envelheça.
- [ ] Showcase com o estado persistido sem a eva: migrar o estado ou fazer `task showcase` acusar a falta e sugerir
  `task showcase:dados:resetar`.
- [ ] `DEFERRED.md`: fechar D19 e os itens do D20 entregues, com evidência.

### Task 5: verificação final e registros

- [ ] Rodar e registrar no relatório:
  - `task test`;
  - `task typecheck`;
  - `task verificar:estatica`;
  - `task scripts:test`;
  - `task verificar:redis`;
  - `CONSTRUIR=1 task verificar:construir`;
  - `task verificar:oidc`;
  - `task showcase:checar`;
  - `task lockstep`.
- [ ] `RETOMADA.md`, `ATIVIDADES.md` (#9) e o ledger (`task orquestrador:ledger`).
- [ ] Revisão final e gate curto (revisor, challenger e auditor), no padrão do `LEIA-PRIMEIRO.md`.
