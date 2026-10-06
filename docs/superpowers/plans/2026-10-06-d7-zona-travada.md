# D7: teto configurável para a zona travada

> **Para agentes:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, task por
> task. Passos com `- [ ]`.

**Objetivo:** a requisição que já entrou numa zona travada é solta no teto configurado (`ERP_ZONA_TETO_MS`, padrão 10 s),
e não mais nos 30 s fixos do Next.

**Arquitetura:** o shell repassa as zonas por `rewrites()`. Quem repassa é o proxy do Next
(`next/dist/server/lib/router-utils/proxy-request.js`), e `experimental.proxyTimeout` é o único controle de tempo dele. O
`next.config.ts` do shell passa a ler esse valor do ambiente por `lerTetoDaZona()` (`lib/configuracao.ts`), que valida
padrão, teto e a relação com `ERP_DESTINO_TIMEOUT_MS`.

**Tecnologia:** Next 16.3.4, `node --test`, verificação ponta a ponta em `base/verificacao/`.

**Decisões do humano:**
- B1 (2026-09-23): teto de 10 s, em variável de ambiente documentada.
- D7 (2026-10-06): **teto agora, página com o C3.** O rewrite do Next não deixa trocar o 500 pela página da base. A página
  de indisponível dentro do teto entra com o mecanismo de roteamento que o C3 vai escolher, para o caminho de toda
  requisição mudar uma vez só.

Nenhuma instalação.

## O que foi medido no Next 16.3.4 (base do desenho)

- **`proxyTimeout` mede inatividade, não duração.** O httpxy faz `proxyReq.setTimeout(proxyTimeout, destroy)`, que é o
  tempo do socket **sem nenhum byte**. Uma resposta que segue mandando dados (página em streaming, download, SSE com
  heartbeat) não é cortada, por mais que dure.
- **Ao estourar, o próprio Next responde.** O `onProxyError` faz `res.statusCode = 500; res.end('Internal Server Error')`.
  Não existe gancho para trocar essa resposta. Por isso a página fica para o C3.
- **O valor é lido ao subir.** O `router-server.js` carrega a configuração com `PHASE_PRODUCTION_SERVER` em todo
  `next start`, então mudar o valor não exige build novo.
- **Sem o D7**, o padrão é `proxyTimeout || 30000`.

## Restrições globais

- Invariantes do `AGENTS.md`. Este plano não toca sessão, credencial nem destino de rede. A N8 continua sem exceção nova.
- **Configuração** (regra do `AGENTS.md`):
  - `ERP_ZONA_TETO_MS`, padrão `10000`, teto `120000`, inteiro positivo;
  - recusa na subida se `ERP_ZONA_TETO_MS <= ERP_DESTINO_TIMEOUT_MS` (padrão deste: `5000`, teto `60000`). Sem essa regra,
    uma página de zona que espera um domínio lento seria cortada antes de degradar;
  - documentada em `docs/CONFIGURACAO.md` §2 **no mesmo commit** que a lê.
- O shell recebe o ambiente inteiro (`ambienteDoPapel('shell', …)` em `base/scripts/ambiente.mjs`). Nada muda na lista de
  inclusão das zonas e domínios, porque só o shell lê a variável.
- **Fora de commit, de propósito** (`RETOMADA.md`, "Ambiente"):
  - `docs/README.md`, `docs/arquitetura/alvo.md` e `docs/arquitetura/infraestrutura-alvo.md`: trabalho do humano;
  - os `pnpm-lock.yaml` de `erp-dominio-stub` e `erp-moldura`.

  Adicionar arquivo por arquivo; nunca `git add -A` nem `git add docs/`.
- Commits sem rodapé de coautoria (hook `no-ai-authorship`). O submódulo é enviado antes do principal (`AMBIENTE.md` §2).
- Revisor de task grava o rascunho desde o começo: `.superpowers/sdd/2026-10-06-d7-zona-travada/review-task<N>-achados.md`,
  primeiro "(parcial)", no fim "(final)". Ao fechar cada task, rodar `task orquestrador:ledger`.

## Como o C2 convive com o teto

O SSE do C2 mora no shell (`/api/stream`), não é repassado a uma zona, e por isso o `proxyTimeout` nem passa por ele. Uma
resposta longa **de zona** que vier depois também convive, porque o teto conta silêncio: basta mandar algum byte (um
comentário `:` de SSE, um pedaço do corpo) em intervalo menor que o teto. Quem precisar ficar mais tempo calado vira pedido
assíncrono, como dizia a decisão B1. Isso vai escrito em `01-operacao.md` §5.1 (Task 2).

## Arquivos

| Arquivo | Repositório | Responsabilidade |
|---|---|---|
| `repos/erp-shell/lib/configuracao.ts` | erp-shell | `lerTetoDaZona(env)`: lê, valida e devolve o teto |
| `repos/erp-shell/next.config.ts` | erp-shell | `experimental.proxyTimeout: lerTetoDaZona()` |
| `repos/erp-shell/test/configuracao.test.mjs` (novo) | erp-shell | unidades do leitor |
| `base/verificacao/base.test.mjs` | raiz | L9: zona travada com sonda válida solta no teto |
| `docs/CONFIGURACAO.md` §2 | raiz | linha de `ERP_ZONA_TETO_MS` |
| `docs/desenho/mfe/01-operacao.md` §5.1 | raiz | a segunda exceção com o teto, o C2 e o que fica para o C3 |
| `docs/arquitetura/atual.md` | raiz | linha "uma zona" da tabela de falhas e linha de testes |
| `.agents/orchestrator/DEFERRED.md` D7 | raiz | o que fechou e o que passa para o C3 |

---

### Task 1: teto da zona no shell (erp-shell)

**Arquivos:**
- Modificar: `repos/erp-shell/lib/configuracao.ts` (acrescentar no fim)
- Modificar: `repos/erp-shell/next.config.ts`
- Criar: `repos/erp-shell/test/configuracao.test.mjs`

**Interfaces:**
- Produz: `export function lerTetoDaZona(env: NodeJS.ProcessEnv = process.env): number`, que devolve o teto em ms ou lança
  `Error` com a mensagem começando por `configuracao invalida:`.
- Produz: `experimental.proxyTimeout` do shell igual a `lerTetoDaZona()`.

- [ ] **Passo 1: escrever os testes que falham**

Criar `repos/erp-shell/test/configuracao.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerTetoDaZona } from '../lib/configuracao.ts'

test('lerTetoDaZona: sem variavel, 10 s (decisao B1)', () => {
  assert.equal(lerTetoDaZona({}), 10_000)
})

test('lerTetoDaZona: le ERP_ZONA_TETO_MS', () => {
  assert.equal(lerTetoDaZona({ ERP_ZONA_TETO_MS: '6000' }), 6_000)
})

test('lerTetoDaZona: valor invalido falha na subida, nunca vira o padrao', () => {
  for (const v of ['0', '-1', '1.5', 'dez', '120001']) {
    assert.throws(() => lerTetoDaZona({ ERP_ZONA_TETO_MS: v }), /configuracao invalida: ERP_ZONA_TETO_MS/, `aceitou "${v}"`)
  }
})

test('lerTetoDaZona: aceita o teto de 120 s', () => {
  assert.equal(lerTetoDaZona({ ERP_ZONA_TETO_MS: '120000' }), 120_000)
})

test('lerTetoDaZona: recusa teto igual ou menor que o timeout de dominio (padrao 5000)', () => {
  assert.throws(() => lerTetoDaZona({ ERP_ZONA_TETO_MS: '5000' }), /maior que ERP_DESTINO_TIMEOUT_MS \(5000\)/)
  assert.throws(
    () => lerTetoDaZona({ ERP_ZONA_TETO_MS: '8000', ERP_DESTINO_TIMEOUT_MS: '8000' }),
    /maior que ERP_DESTINO_TIMEOUT_MS \(8000\)/,
  )
  assert.equal(lerTetoDaZona({ ERP_ZONA_TETO_MS: '4000', ERP_DESTINO_TIMEOUT_MS: '3000' }), 4_000)
})

test('lerTetoDaZona: ERP_DESTINO_TIMEOUT_MS invalido tambem falha (mesma validacao do nucleo)', () => {
  assert.throws(() => lerTetoDaZona({ ERP_DESTINO_TIMEOUT_MS: '60001' }), /configuracao invalida: ERP_DESTINO_TIMEOUT_MS/)
})
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `cd repos/erp-shell && node --conditions react-server --test test/configuracao.test.mjs`
Esperado: FAIL, com `lerTetoDaZona` não exportado (`SyntaxError: The requested module ... does not provide an export named 'lerTetoDaZona'`).

- [ ] **Passo 3: implementar o leitor**

Acrescentar no fim de `repos/erp-shell/lib/configuracao.ts`:

```ts
/**
 * Teto de silêncio de uma zona, em ms (`ERP_ZONA_TETO_MS`, docs/CONFIGURACAO.md §2; padrão 10 s, decisão B1). Vira o
 * `experimental.proxyTimeout` do Next: a resposta repassada é cortada quando a zona passa esse tempo **sem mandar nenhum
 * byte** (inatividade do socket, não duração; streaming que segue mandando dados não é cortado). Tem de passar o timeout
 * de domínio: senão a página que espera um domínio lento seria cortada antes de degradar (D7).
 */
export function lerTetoDaZona(env: NodeJS.ProcessEnv = process.env): number {
  const teto = lerNumeroPositivo(env.ERP_ZONA_TETO_MS, 10_000, 'ERP_ZONA_TETO_MS', 120_000)
  // mesmo padrão e teto do núcleo (`interno/configuracao.ts`), que não exporta o leitor
  const destino = lerNumeroPositivo(env.ERP_DESTINO_TIMEOUT_MS, 5_000, 'ERP_DESTINO_TIMEOUT_MS', 60_000)
  if (teto <= destino) {
    throw new Error(`configuracao invalida: ERP_ZONA_TETO_MS (${teto}) deve ser maior que ERP_DESTINO_TIMEOUT_MS (${destino})`)
  }
  return teto
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `cd repos/erp-shell && node --conditions react-server --test test/configuracao.test.mjs`
Esperado: PASS, 6 testes.

- [ ] **Passo 5: ligar no `next.config.ts`**

`repos/erp-shell/next.config.ts` fica assim. O import vai sem extensão, como o de `./lib/zonas`, porque o carregador de
configuração do Next resolve assim:

```ts
import type { NextConfig } from 'next'
import { lerTetoDaZona } from './lib/configuracao'
import { gerarRewrites } from './lib/zonas'

const config: NextConfig = {
  poweredByHeader: false, // 06-seguranca.md: fingerprinting de framework
  experimental: {
    // D7: zona que passa o teto sem mandar nenhum byte solta a requisição. Quem responde é o Next (500 cru), sem gancho
    // para a página da base; a página dentro do teto vem com o C3. Lido em todo `next start`.
    proxyTimeout: lerTetoDaZona(),
  },
  async rewrites() {
    // Rewrites gerados a partir do mapa central de zonas.
    // Rotas reservadas do shell (/api/auth, /api/otel, /login, /erro-de-zona, /) não são sobrescritas.
    return gerarRewrites()
  },
}

export default config
```

- [ ] **Passo 6: tipos, unidades e build**

Rodar, nesta ordem:
- `cd repos/erp-shell && pnpm typecheck`, esperando 0 erros;
- `pnpm test`, esperando todas passando (eram 108 e passam a 114);
- `pnpm build`, que tem de terminar sem erro. É a prova de que o carregador do Next aceita o import do `next.config.ts`.

Depois, conferir que valor inválido derruba a subida:
`ERP_ZONA_TETO_MS=0 pnpm exec next start -p 3999` deve sair com erro contendo
`configuracao invalida: ERP_ZONA_TETO_MS`. Se, em vez disso, o processo subir, encerrá-lo com `Ctrl+C`: a validação não
está rodando no `next start`, e isso tem de ser corrigido antes de seguir.

- [ ] **Passo 7: commit no submódulo**

```bash
cd repos/erp-shell
git add lib/configuracao.ts next.config.ts test/configuracao.test.mjs
git commit -m "feat(shell): zone silence ceiling from ERP_ZONA_TETO_MS (default 10 s) as the Next proxyTimeout (D7)"
git push
```

O ponteiro do submódulo no principal vai no commit da Task 2, junto com a documentação da variável. É a regra
"documentada no mesmo commit" vista do repositório principal.

---

### Task 2: verificação ponta a ponta e documentos (raiz)

**Arquivos:**
- Modificar: `base/verificacao/base.test.mjs`. O `before` passa a definir o teto, e o teste L9 entra logo depois do L7
  (perto da linha 813, antes do L8).
- Modificar: `docs/CONFIGURACAO.md` §2, uma linha nova depois de `ERP_SONDA_TIMEOUT_MS`.
- Modificar: `docs/desenho/mfe/01-operacao.md` §5.1, o parágrafo "A segunda exceção é a zona travada…".
- Modificar: `docs/arquitetura/atual.md`, a linha "uma zona" da tabela de falhas (perto da linha 206) e a linha "ponta a
  ponta" da tabela de testes (perto da linha 197).
- Modificar: `.agents/orchestrator/DEFERRED.md` D7.
- Ponteiro do submódulo `repos/erp-shell`.

**Interfaces:**
- Consome: `lerTetoDaZona` / `experimental.proxyTimeout` da Task 1. O shell sobe com `ERP_ZONA_TETO_MS=6000` na
  verificação, porque um valor diferente do padrão prova que a variável é lida e não só o padrão de 10 s.
- Consome: `ambiente.congelarApp(dir)` e `ambiente.descongelarApp(dir)` (`base/scripts/ambiente.mjs`), além de
  `pedir`/`entrar` (`base/verificacao/apoio.mjs`).

- [ ] **Passo 1: teto da verificação no `before`**

Em `base/verificacao/base.test.mjs`, no `before`, logo depois da linha `process.env.ERP_REDIS_SENHA_SHELL ??= …`:

```js
  // teto da zona (D7) diferente do padrão de 10 s: o L9 prova que o shell lê a variável. Maior que ERP_DESTINO_TIMEOUT_MS
  // (5 s), senão o shell recusa subir
  process.env.ERP_ZONA_TETO_MS ??= '6000'
```

- [ ] **Passo 2: escrever o L9**

Inserir depois do fim do teste L7 (o bloco que termina com `assert.equal(st, 200, 'a zona 2 nao voltou em 5 s depois de descongelada')`):

```js
test('L9 (D7): zona que trava com a sonda ainda valida solta a requisicao no teto (ERP_ZONA_TETO_MS), nao nos 30 s do Next', { timeout: 90_000 }, async () => {
  const teto = Number(process.env.ERP_ZONA_TETO_MS)
  const ana = (await entrar('ana')).cookie
  const zonaVolta = async () => {
    const t0 = Date.now()
    let st = 0
    while (Date.now() - t0 < 5_000 && st !== 200) {
      st = (await pedir('/zona2', { cookie: ana })).status
      if (st !== 200) await new Promise((r) => setTimeout(r, 100))
    }
    assert.equal(st, 200, 'a zona 2 nao voltou em 5 s depois de descongelada')
  }
  // A requisição precisa passar pela sonda ainda boa (cache de 1 s) e chegar à zona já congelada. Se o cache vencer entre
  // o 200 e o congelamento, a sonda pega a zona e responde 503 em < 1 s (isso é o L7): tenta de novo.
  let segurada
  try {
    for (let i = 0; i < 3 && !segurada; i++) {
      await zonaVolta()
      ambiente.congelarApp('erp-zona-2')
      const t0 = Date.now()
      const r = await fetch(`${SHELL_URL}/zona2`, { headers: { cookie: ana }, redirect: 'manual', signal: AbortSignal.timeout(teto + 10_000) })
        .catch((e) => ({ status: `sem resposta (${e.name})` }))
      const ms = Date.now() - t0
      ambiente.descongelarApp('erp-zona-2')
      if (ms >= 2_000) segurada = { status: r.status, ms }
    }
  } finally { ambiente.descongelarApp('erp-zona-2') }
  await zonaVolta()
  assert.ok(segurada, 'em 3 tentativas nenhuma requisicao chegou a zona congelada com a sonda ainda valida')
  // 500 cru do Next ate o C3 trazer a pagina dentro do teto (DEFERRED.md D7)
  assert.equal(segurada.status, 500, `status ${segurada.status} em ${segurada.ms} ms`)
  assert.ok(segurada.ms >= teto - 500, `soltou em ${segurada.ms} ms, antes do teto de ${teto} ms`)
  assert.ok(segurada.ms < teto + 2_000, `soltou em ${segurada.ms} ms; teto ${teto} ms (sem o D7 seriam ~30 s)`)
})
```

- [ ] **Passo 3: ver o L9 falhar sem a Task 1**

Para provar que o teste pega a falta do D7: comentar a linha `proxyTimeout: lerTetoDaZona(),` em
`repos/erp-shell/next.config.ts`, sem fazer commit, e rodar
`CONSTRUIR=1 node --test --test-name-pattern='L9' base/verificacao/base.test.mjs`.
Esperado: FAIL em `soltou em ~30000 ms; teto 6000 ms`.

Depois, restaurar a linha (`git -C repos/erp-shell checkout next.config.ts`) e rodar de novo o mesmo comando, que tem de
passar. Antes de rodar, conferir com `docker ps` que nenhuma porta 3000–3003 ou 4001–4120 está ocupada por processo velho.

- [ ] **Passo 4: `docs/CONFIGURACAO.md` §2**

Linha nova logo depois da de `ERP_SONDA_TIMEOUT_MS`:

```markdown
| `ERP_ZONA_TETO_MS` | `10000` | Tempo máximo que uma zona pode ficar **sem mandar nenhum byte** numa resposta repassada pelo shell; vira o `experimental.proxyTimeout` do Next. É inatividade, não duração: página em streaming, download ou SSE que segue mandando dados não é cortado. Ao estourar, o Next responde 500 (sem a página da base, que vem com o C3). Teto 120000; tem de ser **maior** que `ERP_DESTINO_TIMEOUT_MS`, senão o shell recusa subir. Lido em todo `next start` | shell (`lib/configuracao.ts`, `next.config.ts`) | ✅ (D7) |
```

- [ ] **Passo 5: `docs/desenho/mfe/01-operacao.md` §5.1**

Trocar o parágrafo que começa em "A segunda exceção é a zona travada" e vai até "…o cache e a sonda reais contra um
destino que nunca responde)." por:

```markdown
A segunda exceção é a zona travada: processo vivo, porta aceitando conexão, sem resposta
(medido com `SIGSTOP`). Uma requisição enviada dentro do mesmo intervalo de 1 s passa pela
sonda e fica presa na zona até o teto do proxy do Next (`experimental.proxyTimeout`), que o
shell lê de `ERP_ZONA_TETO_MS`: **10 s** por padrão (decisão B1, 2026-09-23; antes do D7 era o
padrão fixo do Next, 30 s, observado 3 de 3). No teto, o próprio Next responde 500 cru; o
`rewrites()` não tem gancho para trocar essa resposta pela página da base, que vem com o
mecanismo de roteamento do C3. O teto conta **silêncio**, não duração: é o tempo do socket sem
nenhum byte, então uma resposta longa que segue mandando dados (streaming, download) não é
cortada. O SSE do C2 mora no shell e nem passa pelo proxy; uma resposta longa de zona convive
com o teto mandando algum byte em intervalo menor que ele, e a que precisar ficar mais tempo
calada vira pedido assíncrono. O teto tem de passar `ERP_DESTINO_TIMEOUT_MS` (o shell recusa
subir se não passar): senão uma página que espera um domínio lento seria cortada antes de
degradar. A verificação ponta a ponta (L9) sobe o shell com 6 s e confere a requisição solta
no teto.

Depois do intervalo, a requisição que dispara a sonda espera o timeout da
sonda, 800 ms (815 a 817 ms medidos), e recebe 503. O custo não é único: o cache vale 1 s a
partir do fim de cada sonda, então, enquanto a zona seguir travada, cada expiração abre uma
nova sonda, e toda requisição que chega durante ela espera o restante dessa sonda, até
800 ms. Num fluxo contínuo isso é cerca de 40% das requisições, com espera mediana de
454 ms entre as que esperam mais de 100 ms (175 de 443, uma a cada 20 ms durante 9 s, com
o cache e a sonda reais contra um destino que nunca responde).
```

- [ ] **Passo 6: `docs/arquitetura/atual.md`**

Primeira troca, na linha "uma zona" da tabela de falhas:
- de: `Zona travada segura a requisição ~0,6 s (timeout da sonda).`
- para: `Zona travada segura a requisição ~0,6 s (timeout da sonda); a que já tinha passado pela sonda é solta no teto
  (`ERP_ZONA_TETO_MS`, 10 s) com o 500 cru do Next, até o C3 trazer a página (D7).`

Segunda troca, na linha "ponta a ponta" da tabela de testes:
- de: `zona 2 derrubada (503 em qualquer caixa, volta) e travada (503 em < 2 s);`
- para: `zona 2 derrubada (503 em qualquer caixa, volta) e travada (503 em < 2 s; com a sonda ainda válida, solta no teto, L9);`

- [ ] **Passo 7: `.agents/orchestrator/DEFERRED.md` D7**

Trocar o bloco `## D7 …` inteiro por:

```markdown
## D7 — Zona travada: teto feito, página com o C3

- **Feito (2026-10-06):** o shell lê `ERP_ZONA_TETO_MS` (padrão 10 s, decisão B1) como `experimental.proxyTimeout`; a
  requisição que já passou pela sonda é solta no teto, não nos 30 s fixos do Next. Verificação L9.
- **Fica:** no teto, quem responde é o Next, com 500 cru; o `rewrites()` não tem gancho para a página da base
  (`proxy-request.js`, `onProxyError`). Escolha do humano (2026-10-06): a página dentro do teto vem com o mecanismo de
  roteamento do C3, para o caminho de toda requisição mudar uma vez só.
- **Fecha em:** C3.
```

- [ ] **Passo 8: verificação completa**

Rodar `task test`, que tem de dar todas as unidades verdes (shell com 114), e depois `task verificar`. Esperado no
`verificar`: o modo arquivo com 115 passando + 4 pulados, já que antes eram 114 + 4 e o L9 é o único teste novo. Se
`task verificar:redis` e `task verificar:oidc` fizerem parte da rotina do gate, rodar também, e o `verificar:redis` deve dar
119/119. Anotar os números exatos no relatório da task.

- [ ] **Passo 9: commit no principal**

```bash
git add repos/erp-shell base/verificacao/base.test.mjs docs/CONFIGURACAO.md docs/desenho/mfe/01-operacao.md docs/arquitetura/atual.md .agents/orchestrator/DEFERRED.md
git status --short   # conferir: docs/README.md, docs/arquitetura/alvo.md e infraestrutura-alvo.md continuam fora
git commit -m "feat(d7): zone silence ceiling (ERP_ZONA_TETO_MS, 10 s) verified end to end (L9); docs and D7 entry; shell pointer"
git push
```

---

## Depois das tasks (orquestrador)

- **Gate do D7**, pelo `LEIA-PRIMEIRO.md`: revisor (`revisor-mfe`, Sonnet), challenger (`simulador-condicoes`, Sonnet)
  e auditor forense (Opus, com veto). O auditor muta pelo menos:
  - a linha `proxyTimeout` do `next.config.ts`, que o L9 tem de pegar;
  - o padrão `10_000`, que a unidade tem de pegar;
  - o `<=` da regra contra `ERP_DESTINO_TIMEOUT_MS`;
  - o teto `120_000`.

  O challenger mede o teto com zona congelada e confere que uma resposta em streaming mais longa que o teto, mas com bytes
  em intervalo menor, não é cortada.
- Registrar em `GATE_STATUS.md`, atualizar `ATIVIDADES.md` (#11), `RETOMADA.md` (D7 ✅ com a página passando ao C3) e
  levar ao C3 o requisito "página de indisponível dentro do teto".
