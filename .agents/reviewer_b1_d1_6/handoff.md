# Handoff — reviewer_b1_d1_6

Gate: B1 + D1 + G3 (acesso v2) + fatias K3/K4, iteração 6. Revisor (Sonnet). 2026-09-23.
Escopo revisado: ec08ed1..HEAD no repositório principal e nos submódulos `repos/erp-nucleo` e
`repos/erp-shell` (commits 4f40ba1, 6fd09ad, bf40a18, 0a2d6c9, 7183862; núcleo 00c4c6e..7b03871;
shell cdde1a2..c8a3683). Critério aplicado: Decisão A2 (veto só para defeito de produto ou erro
plausível de boa-fé; contorno deliberado de analisador só reprova se não estiver em `DEFERRED.md` D14).

## Veredito: **REQUEST_CHANGES**

## Achados, por severidade

### 1 (bloqueia) — `base/scripts/ambiente.mjs:79,133,169`: a correção do veto V1 não tem efeito; a zona continua recebendo a credencial de escrita do Redis

A fatia K3 introduziu `envDaApp(dir)` (remove `REDIS_URL` do ambiente de toda app que não seja o
shell) e mudou as chamadas de subida para `iniciar('pnpm', ['start'], join(RAIZ, dir), envDaApp(dir))`
(linhas 133 e 169). Mas `iniciar` continua declarada com só três parâmetros:

```js
const iniciar = (cmd, args, cwd) => {
  const p = spawn(cmd, args, { cwd, env, stdio: log ? 'inherit' : 'ignore', detached: true })
  ...
}
```

`env` aqui é a variável de escopo externo (com `REDIS_URL`, quando `task verificar:redis` a define),
não um parâmetro. O quarto argumento (`envDaApp(dir)`) é silenciosamente descartado pelo
JavaScript — chamar uma função com mais argumentos do que ela declara não gera erro nem os
disponibiliza. `subirApp` e o laço final de `subir()` (que populam `ambiente.apps`, usado pelos
testes) continuam passando `env` (com a credencial) para `spawn` em toda zona.

**Cenário concreto:** com `task verificar:redis` (que define `REDIS_URL=redis://127.0.0.1:6379`
no processo de teste), `erp-zona-1`, `erp-zona-2` e `erp-zona-acesso` sobem com `REDIS_URL` no
próprio ambiente — a mesma condição que o `auditor_b1_d1_4` explorou para gravar uma sessão forjada
de administrador (`E01f`, `mutacoes.txt` linha V1) e logar como ela. O teste novo escrito
exatamente para provar o fechamento deste veto, `base/verificacao/base.test.mjs:909`
(`'V1 (E01f): REDIS_URL de escrita do shell nao esta presente no ambiente das zonas'`), lê
`/proc/<pid>/environ` do processo de cada zona e afirma a ausência de `REDIS_URL=`; com o bug, essa
asserção deveria falhar. Reproduzi o padrão isoladamente (função com a mesma assinatura, mesma
chamada com 4º argumento) fora do repositório: o 4º argumento é ignorado e a variável de closure com
a credencial é a que chega ao "processo" simulado — confirma a leitura estática.

Só `subirAppAvulsa` (linha ~146, que faz `spawn` diretamente com `envAvulso = { ...envDaApp(dir) }`)
aplica a restrição corretamente; é usada só por instâncias avulsas de teste, não pelo caminho
principal.

**Consequência:** a barreira de ambiente que `DEFERRED.md` D14 cita como já em vigor ("a zona não
recebe `REDIS_URL`... conferido em `/proc/<pid>/environ` por `base/verificacao/base.test.mjs` (K3)")
não está, de fato, em vigor. Isso também esvazia parte da defesa que D14 atribui às classes de
contorno deliberado do N8 (elas dependem de "a zona não tem credencial... que valha fora do
registro de destinos"), porque a zona segue tendo a credencial de escrita de sessão.

**Correção:** `iniciar` precisa aceitar e usar o ambiente por chamada, por exemplo:
```js
const iniciar = (cmd, args, cwd, envCustom = env) => {
  const p = spawn(cmd, args, { cwd, env: envCustom, stdio: log ? 'inherit' : 'ignore', detached: true })
  ...
}
```
e depois rodar `task verificar:redis` de novo para confirmar que a asserção de `base.test.mjs:909`
passa com o processo real (não só a leitura estática).

Isto é defeito de comportamento do produto (a correção do veto de segurança da iteração 4 não
funciona), não um contorno deliberado de analisador — está no critério de veto da Decisão A2.

### 6 (reporta, não bloqueia) — `XN09` (assetPrefix com endereço interno) é lacuna aberta desde a iteração 4 e não está em `DEFERRED.md` D14

`auditor_b1_d1_4/mutacoes.txt:87` registra `XN09 | assetPrefix: process.env.DOMINIO_A_URL — inv. 11
— SURVIVED — lacuna (endereço interno no HTML)`. Não há teste em `seguranca-estatica.test.mjs` para
`assetPrefix` com endereço interno (só existe o caso positivo `assetPrefix: '/zona1-static'` na
linha 214, que não passa por um endereço de domínio). A tabela de classes aceitas em `DEFERRED.md`
D14 cita só `XN08` e `XR30` (rota do domínio repassada por `rewrites`/`NextResponse.rewrite`) como
cobertos pela defesa "bloqueio de saída de rede no deploy"; `XN09` fica sem checagem e sem menção
explícita em D14. Não bloqueia por si (defesa equivalente provavelmente vale), mas fica sem teste
executável correspondente — delegar ao agente `testes-invariantes` ou incluir explicitamente em D14.

## Vetos e lacunas da iteração 4 — status conferido

| # | Descrição | Fechado? | Evidência |
|---|---|---|---|
| V1 | zona recebe `REDIS_URL` de escrita | **NÃO** (fix quebrado) | achado 1 acima |
| V2 | escritor de sessão embrulhado escapa da fronteira | Sim | `repos/erp-nucleo/scripts/fronteira.mjs` (símbolos exclusivos do shell, checa por identificador em qualquer lugar fora de `shell/`, cobre alias de import); `repos/erp-nucleo/test/fronteira.test.mjs` (N38d-f) — rodei `pnpm test` em `erp-nucleo` (136/136) |
| V3 | `valorSeguro` aceita `x.campo` objeto | Sim | K4-1 usa o checker do TS (`programaDaApp`, `ehTipoEscalar`) em `base/verificacao/seguranca-estatica.mjs`; teste `seguranca-estatica.test.mjs` "V3 (K4, auditor_b1_d1_4)" cobre exatamente `envio.resumo` (objeto) e `envio: any` (reprova) — o caso que passava na iteração 5 invalidada. Rodei `task verificar:estatica`: 39/39 |
| V4 | `fetch` mascarado por parâmetro; `test/` aninhado pulado; `next/dist/*` liberado | Sim | escopo léxico por pilha em `saida-de-rede.mjs` (`escopos`/`estaDeclarado`); `fontesDaApp` só pula `test/` na raiz (`d === raizDaApp && n === 'test'`); allowlist de subpaths de `next/*`. Testes V4 (XR20p/XR23p/XR38p) em `saida-de-rede.test.mjs`; 39/39 |
| V5 | `next.config` com `env=` por atribuição, chave calculada | Sim | detecção de `EqualsToken`/chave calculada em `seguranca-estatica.mjs`; teste "V5 (XN01p)"; E2E "V5 (XN01p): bundles estaticos..." em `base.test.mjs` (procura `127.0.0.1:40\d\d` e `redis://` em `.next/static`) |
| L1 | `P0-acao-protegida` contornável | Não fechado; sem mudança nesta fatia | consistente com a fatia K3 não declarar L1 fechado; segue como lacuna |
| L2 | `If-Match` fixo em "3" | Sim | teste novo "L2 (P16b)" em `base.test.mjs` conclui t-2 (versão 1) |
| L3 | cache "fora" com validade de 1 ms | Sim (só teste; produto já correto) | `repos/erp-shell/test/saude.test.mjs` "S17b" — rodei `pnpm test` em `erp-shell` (43/43) |
| L4 | `router.push(variavel)`, push desestruturado | Contorno deliberado, classificado em D14 ("navegação entre zonas escrita de forma indireta") | `DEFERRED.md` D14 |
| L5 | `rewrites`/`assetPrefix` com endereço interno | Parcial: `XN08`/`XR30` em D14; `XN09` (`assetPrefix`) sem teste e sem menção em D14 | achado 6 acima |

## Fronteiras de camada e Multi-Zones

Nada no diff faz `interno/` importar de `adaptadores/`/`fabricas/`, nada fora do núcleo alcança
`interno/` por outro subpath além de `@erp/nucleo`/`@erp/nucleo/proxy`/`@erp/nucleo/permissoes`/
`@erp/nucleo/testing`, e a mudança em `fronteira.mjs` só adiciona restrição (símbolos exclusivos do
shell), não afrouxa nada. Não há rota de API de zona fora de `app/{zona}/api/bff/`, nem `<Link>`
entre zonas, nem redirect de Server Action para outra zona neste diff — as mudanças de produto se
restringem a scripts de infraestrutura (`ambiente.mjs`, `Taskfile.yml`) e analisadores estáticos
(`base/verificacao/`). `base/showcase/medicao-refresh-concorrente.mjs` fala direto com o Keycloak do
showcase por HTTP (fora do Next, com origem fixa) para a Medição 1 pedida pelo humano — mesma classe
de exceção já documentada para `scripts/registrar-manifesto.ts`; não é parte do BFF em runtime, não
reprova o invariante 4.

## Comandos rodados (sem usar portas da base — havia um processo do challenger já no ar
subindo 3000-3003/4001-4004/4020; não interferi)

- `task test`: contratos 20/20, núcleo 136/136, moldura 26/26, stub 43/43, shell 43/43 — todos verdes.
- `task typecheck`: 0 erros nas 4 apps (erp-shell, erp-zona-1, erp-zona-2, erp-zona-acesso).
- `task verificar:estatica`: 39/39.
- `task scripts:test`: 14/14.
- `node base/scripts/verificar-lockstep.mjs`: `lockstep ok: @erp/nucleo 0.9.2 em 4 aplicacoes`.
- Não rodei `task verificar` / `task verificar:redis` (usam as portas da base, reservadas ao
  challenger nesta rodada). O achado 1 foi confirmado por leitura de código e por reprodução
  isolada do padrão de closure/argumento fora do repositório (script descartável, sem tocar
  portas nem processos da base) — não pela execução do E2E real. Se o challenger desta iteração
  rodar `task verificar:redis`, o teste `base.test.mjs:909` (V1 E01f) é o que deve mostrar o
  vermelho; se por algum motivo ambiental ele passar, vale reabrir a investigação (ver nota abaixo).

**Nota de confiança:** minha confirmação do achado 1 é por leitura direta do código-fonte atual
(a assinatura de `iniciar` tem 3 parâmetros; `spawn` usa a variável de closure `env`; chamadas
passam um 4º argumento, que o JavaScript descarta sem erro) e por reprodução do mesmo padrão de
código num script isolado — não por rodar o `subir()` real com Redis. Se alguém quiser refutar,
o teste decisivo é `CONSTRUIR=1 task verificar:redis` e olhar especificamente para a suíte
"V1 (E01f)" em `base/verificacao/base.test.mjs`.

## Por que REQUEST_CHANGES

O achado 1 é exatamente o tipo de coisa que a Decisão A2 manda vetar: um defeito real de
comportamento do produto (a correção do veto de segurança mais grave da iteração 4 não funciona),
não um contorno deliberado de analisador. Os demais vetos e lacunas da iteração 4 (V2-V5, L2, L3)
foram fechados com teste que os prova; L1, L4 e a parte de L5 seguem como lacunas/limites
aceitáveis sob D14 ou sem mudança nesta fatia (não pioraram). O achado 6 (XN09) é só apontado, sem
veto.
