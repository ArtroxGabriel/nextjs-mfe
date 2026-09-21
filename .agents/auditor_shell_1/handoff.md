# auditor_shell_1: gate "Shell novo (Gabriel)"

**Veredito: INTEGRITY VIOLATION** (veto)

Escopo: `repos/erp-shell` em `666216c` (é `a63b995` mais o lockfile; código de `6de4939`, `dab5ffd`, `a63b995`),
`lib/pagina.ts` das zonas (`bac6d37` e os equivalentes em zona-2 e acesso) e `repos/verificacao` (`32083d6`).
Todas as mutações rodaram numa cópia (`scratchpad/repos-copia`, `cp -a` com `node_modules`). A árvore real
não foi editada. Tabela completa em `mutacoes.txt`. Scripts e saídas brutas estão em `anexos/`.

Durante a auditoria entraram commits de outra pessoa no principal (`6fe3a71`..`c45b675`) e nos submódulos
(`820c61a`, `f18310d` no shell, e os equivalentes nas zonas). São só documentação: `git diff` do HEAD da
cópia até o HEAD atual, excluindo `*.md`, dá vazio nos quatro apps. O resultado vale para o código atual.

## Números reproduzidos
- `node --test test/*.test.mjs` em `repos/erp-shell`: **22/22** (árvore real).
- `node --test repos/verificacao/*.test.mjs`: **26/26** na árvore real, com os builds existentes. Na cópia,
  com `CONSTRUIR=1`: **26/26**.
- Revertendo `repos/verificacao` para `32083d6^`: 26/26 (V1). A mudança do Gabriel não afrouxa nada nos
  builds atuais, porque o manifesto ainda traz `app/zona2/acoes.ts` e o segmento extraído sai igual.
  O `endsWith(arquivo)` sem `/` é mais frouxo do que precisa, mas nenhum chamador passa sufixo curto.

## Por que é veto
Achei três comportamentos declarados que regridem, ou já estão quebrados, com todas as suítes verdes.

### V1: "gestão de acesso fora → sem a página: ninguém entra em módulo" (`atual.md` §8) está quebrado e o teste D4 não vê
Com o `exigirModulo` fail-open (`a63b995` e `bac6d37`), o código atual **vaza o conteúdo do módulo** quando
a gestão de acesso cai. Medi na cópia, com `:4010` derrubada e davi, que não tem módulo nenhum:

- `/zona1/relatorios` responde 200 e mostra "Serviço indisponível", mas o payload RSC no mesmo HTML traz
  `["$","h1",…,"Relatórios"],["$","p",…,[2," recursos no seu escopo; ",0," com custo visível."]]`. Com bruno,
  o mesmo payload traz 3 recursos, 3 deles com custo.
- `/zona1` responde 200 e o payload contém "Painel da zona 1".

O layout troca `children` por `<ServicoIndisponivel/>`, mas o Next renderiza o segmento da página mesmo
assim e o serializa no `self.__next_f`. Com o fail-closed anterior (M9), as mesmas quatro requisições não
trazem nenhum dado de módulo. A evidência está em `anexos/sonda-base.txt` e `anexos/sonda-M9.txt`.

**Nenhuma suíte distingue fail-open de fail-closed:** o e2e dá 26/26 nos dois. O D4 falha como teste por três motivos:
1. procura `Painel da zona 1</h1>`, que só existiria no HTML renderizado; no payload RSC o texto aparece
   em JSON;
2. não visita nenhuma página com `exigirModulo` restrito (`/zona1/relatorios`);
3. usa ana, que tem os módulos; um usuário sem concessão mostraria o vazamento.

Isso confirma o Achado 1 do reviewer_shell_1 com medição e mostra que o problema é pior que "pode vazar":
**vaza hoje, inclusive para quem nunca teve concessão**.

### V2: "/api/otel sem sessão: 204 e descarta" (`atual.md` §1.1) é falso, e nenhum teste o protege
`route.ts` só retorna antes do repasse quando `status !== 204`. Sem sessão, `processarLoteDeTelemetria`
devolve 204, e o handler **repassa o lote ao `OTEL_EXPORTER_OTLP_ENDPOINT`**. Medi com um coletor falso:
um POST sem cookie chegou ao coletor (L4 com `REPASSE=1`). Por isso M6a (tirar a checagem de sessão da função
pura) e M6b (sessão sempre válida na rota) sobrevivem. O único teste de "sem sessão" confere o status 204,
que é igual para lote descartado e lote aceito. Isto vai além dos achados 3 e 4 do reviewer: é um anônimo
injetando spans no coletor.

### V3: o 503 da zona fora (§8, A12) só é protegido na função pura; a tradução para HTTP e o TTL não são
- M4b2 (o `proxy.ts` devolve 500 cru) e M4c (503 sem `Retry-After` e sem `no-store`) sobrevivem a tudo.
  O e2e nunca derruba uma zona: `ambiente.mjs` só sabe derrubar domínio.
- M3/M3b (TTL infinito): nenhum teste faz o tempo passar. Uma zona que caiu depois de uma sonda boa ficaria
  em 500 cru para sempre, e "volta em ~1 s" também deixaria de valer.
- M14/M14b (sem timeout de 500 ms) e M15 ("status ≥ 500 = fora" desligado) sobrevivem. O §1.1 declara
  os dois.
- M13 (asset estático antes da sonda) sobrevive.

## Respostas às perguntas do pedido
| Mutação pedida | Resultado |
|---|---|
| sonda removida | pega (unidade "Cenario 1"); e2e verde |
| saudável/indisponível invertido | pega (unidade e e2e) |
| TTL infinito | **sobrevive** |
| 500 cru sem Retry-After | na decisão: pega (unidade). No `proxy.ts`: **sobrevive** |
| sem `no-store` | na decisão: pega. No `proxy.ts`: **sobrevive** |
| `/api/otel` sem exigência e handler sem checar sessão | **sobrevive** (e o código atual já repassa o lote anônimo) |
| sem 413 | na função pura: pega. Na rota: **sobrevive** |
| sem 429 | na função pura: pega. Na rota: **sobrevive** |
| `exigirModulo` fail-open × fail-closed | **nenhuma suíte distingue**; o fail-open vaza (V1) |
| sem `headers.delete('x-erp-flash')` | **sobrevive**: o teste só usa `/zona1`, onde o proxy da zona apaga o cabeçalho. Nas páginas do shell (`/`) nada o cobre |
| sem nonce na CSP | pega (e2e "CSP com nonce") |
| `encontrarZonaPorCaminho` case-insensitive (correção do C1) | nenhum teste muda (22/22, 26/26): a correção do C1 entraria sem proteção |

Mutações extras que sobrevivem: `/api/*` inteiro tratado como telemetria, sem cookie (M18); rotas públicas
sem CSP (M17); cookie de flash não apagado no shell (M16); `x-erp-caminho` fixo (M20).

Observação ao vivo que fecha a suspeita do reviewer: em `/zona1` chega **um** cabeçalho CSP, o da zona
(com `img-src` e `form-action`). A CSP de resposta do shell é sobrescrita, então não há interseção de nonces.

## Comportamento declarado → existe teste que reprova a regressão?
| Declaração | Teste | Regressão pega? |
|---|---|---|
| §1.1 `/login`, `/api/auth`, `/erro-de-zona` públicos | unidade "rotas publicas" | sim |
| §1.1 … "com CSP e nonce" | nenhum | **não** (M17) |
| §1.1 `/api/otel` sem sessão: 204 e descarta | unidade (só o status) | **não**; hoje está quebrado (V2) |
| §1.1 > 256 KB: 413 · > 60 lotes/min: 429 | unidade da função pura | só na função; na rota **não** (M7b, M8b) |
| §1.1 prefixo de zona passa pela sonda | unidade "Cenario 1" | sim (M1). Com outra caixa (C1): **não** |
| §1.1 cache 1 s | unidade "TTL" (só o acerto do cache) | **não** para expiração (M3) |
| §1.1 timeout 500 ms | nenhum | **não** (M14) |
| §1.1 fora = erro de rede **ou status ≥ 500** | só erro de rede | **não** (M15) |
| §1.1 503 · Retry-After 5 · página | unidade da decisão | na decisão sim; no HTTP **não** (M4b2, M4c) |
| §1.1 asset estático → rewrite, depois da sonda | nenhum | **não** (M13) |
| §1.1 sem cookie → 307 `/login?de=` | unidade + e2e camada 1 | sim (M19) |
| §1.1 segue com CSP (nonce) | e2e "CSP com nonce" | sim (M11a/b) |
| §1.1 … `x-erp-caminho` | nenhum no shell | **não** (M20) |
| §1.1 … flash consumido (e o forjado apagado) | e2e N4 e "flash ignorado", só em `/zona1` | **não** para o shell (M10, M16) |
| §1.1 rewrites e busca de zona do mesmo `zonas.json` | unidade `gerarRewrites`/`encontrarZonaPorCaminho` | parcial: `gerarRewrites` é testado com lista literal |
| §8 domínio de negócio cai → só o bloco | e2e D5 | sim |
| §8 gestão de acesso cai → sem a página | e2e D4 | **não** (M9 indistinguível; vaza hoje, V1) |
| §8 zona cai → 503 + Retry-After 5 + página | unidade da decisão | **não** no HTTP (V3) |
| §8 … as outras zonas seguem | nenhum | **não** |
| §8 … cache de 1 s por zona | nenhum sobre expiração | **não** (M3) |
| A12 503, página, `/` e `/zona1` seguem | nenhum automático | **não** |
| A12 volta em ~1 s | nenhum | **não**; o challenger mediu 1,2–1,3 s |

## Testes mínimos que fecham as lacunas
Estão escritos e rodados na cópia: `anexos/lacunas.test.mjs`, no formato de `repos/verificacao`. Para
derrubar a zona, bastaria um `derrubarApp`/`subirApp` em `ambiente.mjs`. O arquivo usa `ss` e `pnpm start`
porque eu não podia editar `repos/`.

- **L1**: com a gestão de acesso fora, davi em `/zona1` e `/zona1/relatorios`, e o HTML inteiro, payload RSC
  incluído, não pode conter `Painel da zona 1` nem `recursos no seu escopo`. Falha no código atual e passa
  com o fail-closed. É a troca do D4: tirar o `</h1>` da regex e acrescentar a página restrita.
- **L2**: zona 2 morta por mais que o TTL: `/zona2` e `/zona2/x` → 503, `Retry-After: 5`, `no-store` e a
  página própria; `/` e `/zona1` → 200; religada, volta a 200 em menos de 3 s. Pega M4b2, M4c, M3 e M5b.
  Com `/ZONA2` (`CAIXA=1`), reprova hoje (C1) e passaria a proteger a correção do C1.
- **L3**: `x-erp-flash` forjado em `/` não aparece. Pega M10.
- **L4**: POST sem cookie → 204 **e o coletor falso não recebe nada** (`REPASSE=1`; reprova hoje, V2);
  300 KB chunked sem `Content-Length` → 413; o 61º lote → 429 com `Retry-After: 60`. Pega M7b e M8b.
  Para os achados do reviewer, o teste certo é o corpo chunked grande ser recusado **antes** da leitura:
  411 sem `Content-Length`, ou corte no streaming.
- **Unidade** (sem servidor): cache com relógio injetável, em que a entrada expira depois do TTL e a sonda roda
  de novo (M3); `fetchFake` que nunca resolve → `false` em ~timeout (M14); `fetchFake` com `{status: 500}` →
  `false` (M15); zona morta + `/zona1-static/x` → `zona-inativa` (M13);
  `encontrarZonaPorCaminho('/ZONA1')` → zona1 (C1); `/api/stream` sem cookie → login (M18).
- Falta um teste de CSP em `/login` (M17): nenhum dos acima o pega.

## Arrumação
- Portas 3000–3003, 4001–4004 e 4010 livres no fim (`ss -ltn`). Nenhum `next start` nem `servidor.mjs`
  ficou vivo. O Verdaccio (:4873) não foi tocado.
- `git status --short` limpo nos oito `repos/erp-*`. No principal só aparecem as pastas não rastreadas dos
  verificadores (`.agents/challenger_shell_1/`, `.agents/reviewer_shell_1/`) e esta.
- Não instalei pacote nenhum. Só escrevi em `.agents/auditor_shell_1/` e no scratchpad.
