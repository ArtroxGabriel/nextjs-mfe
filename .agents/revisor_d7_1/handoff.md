# Handoff revisor_d7_1 (final)

## Veredito: APROVA

Nenhum achado Crítico ou Importante. 4 menores (nenhum bloqueia o gate).

## Achados

### Menor 1 — teto cobre uma chamada de domínio, não a página inteira (suspeita)
`repos/erp-shell/lib/configuracao.ts:32-38`. A regra `teto > ERP_DESTINO_TIMEOUT_MS` protege uma chamada. Uma página de zona
com N chamadas sequenciais lentas (cada uma degradando em 5 s) fica calada N*5 s; sem Suspense/streaming que mande bytes
antes, o shell a corta em 10 s com 500 cru, antes de degradar. Confirmaria: página de zona com 3 `nucleo.destino` sequenciais
contra domínio que nunca responde. Correção: documentar a limitação em `CONFIGURACAO.md`/`01-operacao.md` §5.1 (ou levar ao C3).
Não é regressão do D7 (antes era 30 s).

### Menor 2 — padrão/teto de ERP_DESTINO_TIMEOUT_MS duplicados sem teste de paridade
`lib/configuracao.ts:34`. Hoje batem com `repos/erp-nucleo/src/interno/configuracao.ts:40` (5_000 / 60_000). Se o núcleo mudar, o
shell valida contra número velho. Já registrado na revisão da Task 1. Correção: teste que compare com o núcleo, ou exportar o leitor.

### Menor 3 — L9 usa `??=`
`base/verificacao/base.test.mjs` (before). `ERP_ZONA_TETO_MS` exportada vazia ('') no ambiente faz `??=` não atribuir e `Number('')`=0
no teste, enquanto o shell usa 10 s. Só afeta quem exporta a variável vazia; falha ruidosa, não falso verde.

### Menor 4 — dívidas pré-existentes/de documentação já registradas
`atual.md` com contagens de testes defasadas; sonda 800 ms (01-operacao) vs 500 ms (CONFIGURACAO). Pré-existentes, não do D7.

## Conferido sem achado
- Invariantes: diff não toca sessão, credencial, destino de rede nem `fetch`; N8 sem exceção nova; sem `NEXT_PUBLIC_*`.
- Configuração: padrão 10 s, teto 120 s, inteiro positivo, falha na subida (via `lerNumeroPositivo`), documentada em `CONFIGURACAO.md` §2
  no mesmo commit que o ponteiro do shell que a lê (f01b25d).
- Padrão/teto de `ERP_DESTINO_TIMEOUT_MS` do shell (5000/60000) batem com o núcleo.
- Só o shell lê `ERP_ZONA_TETO_MS` (grep: lib/configuracao.ts, next.config.ts, testes, docs); `base/scripts/ambiente.mjs` sem alteração
  (lista de zonas/domínios inalterada).
- Ponteiro `repos/erp-shell` = 45787f1.
- L9: espera 500, `ms >= teto-500` e `< teto+2000`, com teto 6 s diferente do padrão 10 s e do 30 s do Next; fetch aborta em teto+10 s;
  descongela em `finally`; descarta tentativas < 2 s (caso L7). Prova que o corte vem do teto, não da sonda (≤800 ms) nem dos 30 s.
- Decisão do humano: DEFERRED D7, `CONFIGURACAO.md`, `01-operacao.md` §5.1, `atual.md` dizem 500 cru do Next e página com o C3;
  `RETOMADA.md:72` registra o requisito no C3. Nenhum documento dá a página como entregue.
- Interações: sonda `ERP_SONDA_TIMEOUT_MS` (≤2 s) bem abaixo do teto; `/api/stream` e `/api/auth|otel` são do shell, fora do rewrite;
  streaming que manda bytes não é cortado (inatividade); fragmentos ADR-0011 são chamadas servidor a servidor, não repassadas pelo
  proxy do shell (ver Menor 1 para o caso de página lenta); `proxyTimeout` B1 = 10 s é o próprio padrão.
- Não rodei testes nem a base (portas reservadas ao challenger).
