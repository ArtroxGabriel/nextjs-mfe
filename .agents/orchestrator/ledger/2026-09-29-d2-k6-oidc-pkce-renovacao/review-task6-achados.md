# Revisão Task 6 (D2): achados (final)

Revisor: spec + qualidade. Pacote: `review-task6.diff` (núcleo 2fa8c06..63e0425, stub 783242b..962932c, shell/zonas
só bump 0.10.2, principal 1f4414c..0d391d0).

**Veredito: aprovado com ressalvas.** Nada Critical. Um Important no teste ponta a ponta OIDC: a afirmação
"20 concorrentes na janela sem derrubar a sessão" pode passar sem que haja renovação no lote. Os documentos já
citam esse teste como evidência.

## Progresso
- [x] erp-nucleo (http-local, identidade-oidc, csp, configuracao): `pnpm test` 225/225 rodado pelo revisor
- [x] erp-dominio-stub (jwt.mjs): `pnpm test` 75/75 rodado pelo revisor
- [x] shell/zonas (só `@erp/nucleo` 0.10.2; `build`/`start` sem a flag)
- [x] principal (Taskfile, ambiente.mjs, medir-proxy, showcase/subir, verificacao/oidc, docs, orquestrador)

## Important

### I1. O teste de 20 concorrentes não prova que houve renovação no lote
- `base/verificacao/oidc/oidc.test.mjs:186-194`. O lote cai "na janela" só por cálculo de tempo:
  `esperar((VIDA_S - JANELA_S + 1) * 1000)`, com janela de 5 s e margem de cerca de 4 s depois do render anterior.
  Nada confere que o token estava na janela, nem que foi renovado uma vez só.
- Duas mutações passariam:
  - (a) o proxy só renova o token já vencido, nunca dentro da janela. O lote passa sem renovar, e o passo seguinte
    (depois do vencimento) renova normalmente;
  - (b) sem lock, com o lote fora da janela por atraso de máquina: ninguém renova e nada é pego.
- O que o teste prova de fato (página 200 depois do vencimento; mutação sem `renovarSessao` pega) está correto. O
  que fica sem prova é a frase repetida no ADR-0013 (Em aberto 1), em `11-testes.md` §3.2, em PENDENCIAS §4 e em
  `atual.md`.
- **Correção:** o teste já recebe `REDIS_URL`. Antes do lote, ler `erp:sessao:<id>` (o id vem de
  `entrarPeloKeycloak`) e afirmar `tokenExpiraEm - agora < JANELA_S*1000` e `> 0`. Depois do lote, afirmar que
  `tokenExpiraEm` avançou e que o `refreshToken` mudou exatamente uma vez. Alternativa sem ler o store: contar as
  sessões e os tokens do cliente pela API de administração do Keycloak. Rodar a mutação (a) e registrá-la como pega.

## Minor
- M1. `docs/CONFIGURACAO.md:21` (`IDP_EMISSOR`: "`https://` obrigatório em produção"), `:24` (`IDP_URL_RETORNO`:
  "que o núcleo recusa em produção") e `:61` (stub: "`http://` só fora de produção"), além do ADR-0013 decisão 5
  (linha 32): falta citar a exceção do adendo 2. Correção: acrescentar "(exceto loopback com
  `ERP_PERMITIR_HTTP_LOCAL=1`, adendo 2)".
- M2. `Taskfile.yml` `verificar:oidc` e `oidc.test.mjs:29-35`: sem o Keycloak, o `describe` pula e sai com 0. No gate,
  "verde" pode ser só "pulado". Correção: a tarefa define `VERIFICAR_OIDC_EXIGIR=1`, e com ele o motivo para pular
  vira falha.
- M3. `oidc.test.mjs:177`: `http://127.0.0.1:4001` fixo. Correção: usar a constante/porta do domínio A de
  `base/scripts/ambiente.mjs`.
- M4. `oidc.test.mjs:197-211`: o logout confere só a URL do 303, sem segui-la no Keycloak. O menor adiado da T3
  ("sem `id_token_hint` o Keycloak pode não redirecionar") ficou verificável com este harness e não foi conferido,
  e o ROTEIRO (A11) afirma que "Sair passa pelo logout do Keycloak". Sem reabrir: anotar na triagem da revisão final.
- M5. `repos/erp-dominio-stub/pnpm-lock.yaml` fora do commit: mesma `@erp/contratos@0.2.1` com integridade diferente
  (republicação no Verdaccio local). O relatório já cita; registrar em AMBIENTE se ainda não estiver lá.

## Verificado sem problema
- Loopback (`borda/http-local.ts`): igualdade com `URL.hostname` normalizado (`localhost`, `127.0.0.1`, `[::1]`).
  `127.0.0.1.evil.example`, `localhost.`, `localhost@evil.example`, `#@localhost`, `0.0.0.0`, `[::ffff:127.0.0.1]`,
  `[::2]` e `127.0.0.2.nip.io` são recusados. Maiúsculas e `[0:…:1]` são normalizados e aceitos. Credencial na URL
  continua recusada à parte. A flag só vale com o valor exato `1`.
- Uma regra só: o adaptador OIDC (emissor, retorno, pós-logout) e a CSP (`validarOrigem`) usam `httpPermitido`. Na
  regex `ORIGEM`, o IPv6 só entra entre colchetes e com hexadecimal; `origin === valor` recusa forma não normalizada.
  Os endpoints do discovery continuam presos à origem do emissor (`identidade-oidc.ts:124`), o que limita o alcance
  do `allowInsecureRequests`.
- Fronteira: `adaptadores → interno → borda` respeita `scripts/fronteira.mjs`; `borda` sem `server-only`; o adaptador
  mantém `import 'server-only'` (inv. 3).
- O stub espelha a regra (`src/jwt.mjs`) e lê a flag do ambiente com o valor exato.
- Onde a flag aparece: só em `Taskfile.yml` `verificar:oidc`, em `subir.mjs` com `--oidc` (`??=`) e na lista de
  inclusão de zona e domínio (`ambiente.mjs`). Nenhum `build`/`start` das apps a liga. Está documentada em
  CONFIGURACAO §1 e §4 e nenhuma `NEXT_PUBLIC_*` foi criada (inv. 11).
- Testes que reprovam com o código revertido, conferidos por leitura:
  - núcleo: sem checar loopback; flag por truthiness; CSP ou adaptador com a regra antiga (casos "com a flag aceita"
    e "fora do loopback recusado");
  - stub: o mesmo, mais `verificadorDoAmbiente` com `'true'`;
  - `ambiente.test` V1: o relatório mostra que reprovou antes da inclusão.
- Teste do ADR, página 200 depois do 1º token vencer: há controle de que o domínio recusa token vencido (401), e a
  mutação sem renovação no proxy foi pega, segundo o relatório.
- Varredura de `refresh_token`, `id_token`, `eyJ`, `accessToken`, `refreshToken` e `idToken` em HTML, RSC e cookies, e
  de `eyJ` e do segredo nos scripts. O `after` restaura a vida do token com um token de administração novo.
- Invariantes 1, 4, 13 e 15: nenhum token no navegador; o IdP só passa pelo `identidadeOidc`; o shell declara
  `openid-client`, mas nenhuma app o importa (N8, `PACOTES_PERMITIDOS`); nenhum cache; a renovação fica no proxy do
  shell.
- `medir-proxy.mjs`: método A×B correto, `MEDIR_N` documentado, tarefa com `desc`.
- Documentos da lista do ADR-0013 atualizados e coerentes: AGENTS inv. 4 e 15, 02, 06, 11, PENDENCIAS, mfe/00 e 01,
  ADR-0002, ADR-0009, atual e alvo. A justificativa para não mexer em `03-extensoes` §3.1 procede.
- DEFERRED: D16 fechado; D17 e D18 registrados com evidência.
