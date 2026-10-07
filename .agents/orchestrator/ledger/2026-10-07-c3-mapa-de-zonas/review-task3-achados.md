# Revisão Task 3 — mapa vivo de zonas no shell (final)

Escopo: diff `review-task3.diff` (erp-shell 2f03183..aa128c7 + `docs/CONFIGURACAO.md`). Leituras fora do diff, por risco nomeado:
`base/scripts/ambiente.mjs` (env do build/start), `repos/erp-shell/lib/redis.ts` (guarda sem timeout),
`repos/erp-nucleo/src/interno/destinos.ts:104-140` (credencial de serviço, `lerTraceparent`), stub `base.mjs` (token aceito),
`repos/erp-zona-1/scripts/registrar-rota.ts:14` (uso do mesmo `ERP_TOKEN_SERVICO`).
Sondagem executada: 26 origens contra `origemPermitida` (`node --conditions react-server`).

## Spec: ✅ (com 1 ⚠️)
Interfaces exatas; validação, TTL, último bom, guarda revalidada, boot frio, `urlSaude`; testes exigidos e M1–M8.
⚠️ "em produção sem a variável o shell não sobe": hoje só lança no import; nada importa o módulo ainda (Task 4).

## Risco (a) origemPermitida — limpo
Recusadas: `127.0.0.1.evil`, `%2eevil`, userinfo, `\@`, `;`, IPv6 com `*`, `localhost.`, caminho `//`.
Aceitas só as que normalizam para origem permitida (`2130706433`, `0x7f.1`, `127.0.0.1.`, maiúsculas, fullwidth, porta omitida,
`:080`); a zona guarda `new URL(origem).origin`, então validado = usado. `*` não cruza `:`.

## Achados
- Important 1 — base roda `next start` (NODE_ENV=production): sem env, `lerOrigensPermitidas` lança e `lerTokenDeServico` dá undefined
  (mapa sempre vazio). `ERP_TOKEN_SERVICO` é repassado às zonas, então não dá para defini-lo como `svc.shell` no ambiente comum.
  Parte plan-mandated (nome da variável). Relatório diz "nada a adicionar" — incorreto.
- Important 2 — `await guarda.gravar` dentro do voo único (mapa-zonas.ts:152) e `guarda.ler` sem timeout (:160): Redis travado prende
  o boot frio e todas as releituras, mesmo com a fonte no ar.
- Minor — instância criada no import (:223); padrões sem validação de formato; mapa vazio só retenta após TTL; sem `server-only`;
  `ACESSO_URL` na doc não cita `/v2/zonas`; fonte/guarda do shell sem teste de unidade.

## Veredito: Needs fixes
