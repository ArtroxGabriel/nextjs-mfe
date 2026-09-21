# Estado da execução — atualizado em 2026-09-21

> **2026-09-21:** o plano da fatia 1 (tasks 8–11) foi substituído pela base genérica do
> [ADR-0009](../design-bff/comum/docs/adr/0009-base-generica.md). Tasks 1–7 continuam válidas
> como história; o núcleo foi generalizado (0.2.x) e shell + três zonas existem em `repos/`.
> Estado atual e como rodar: `README.md` (seção base genérica) e `docs/arquitetura/atual.md`.
> As seções abaixo são histórico de 2026-09-15.

Retomada: leia este arquivo, `O que falta para finalizar a arquitetura.md` (fonte da verdade)
e `.agents/orchestrator/RETOMADA.md`.

---

## 1. Onde parou

| Task | Estado |
|---|---|
| 1 — Verdaccio | ✅ completa, migrado para Docker Compose (`repos/docker-compose.yml`) com volume |
| 2 — `@erp/contratos` | ✅ completa, revisada, **publicada** no Verdaccio |
| 3 — núcleo: erros + allowlist | ✅ completa, revisada |
| 4 — porta de dados + adaptadores | ✅ completa, revisada |
| 5 — sessão, identidade, fábricas | ✅ **fix completo** (isolamento token, `entrar()`, `this` desacoplado, `prefixo` no proxy, 32/32 testes) |
| 6 — exports restritos + linter de fronteira | ✅ **completa** (4 subpaths, linter `scripts/fronteira.mjs`, 37/37 testes, publicado) |
| 7 — stub de domínio (`erp-dominio-stub`) | ✅ **completa, revisada** (`5367642` + `fix` de revisão; 16/16 testes, 16/16 mutações pegas; revisor-mfe APPROVE; 2 defeitos do plano corrigidos, ver §5.1) |
| 8 a 11 | não iniciadas |

**O ponto exato da parada:** As Tasks 1 a 6 do `@erp/nucleo` e `@erp/contratos` estão 100% implementadas,
testadas e publicadas no registro Verdaccio local (`localhost:4873`). Os submódulos estão configurados via SSH.
A Task 7 (`erp-dominio-stub`) foi concluída e revisada em 2026-09-15. **A Task 8 está pausada**: a revisão `docs/revisao/2026-09-15-revisao-base-generica.md` mostrou que o plano acopla a base ao caso; retomar só depois das decisões da §7 dela e do replanejamento. Texto anterior: a próxima era a Task 8 (`erp-shell`), que instala `next`, `react`, `react-dom`, `typescript` e `@types/*` e exige aprovação antes do install. Texto histórico: o próximo passo era iniciar a Task 7, conforme especificado em
`docs/superpowers/plans/2026-09-09-base-mfe-fatia-1.md` linha 1836.

### O primeiro passo da retomada

Iniciar a **Task 7**:
1. Criar o repositório/submódulo `repos/erp-dominio-stub` (ou diretório conforme o plano).
2. Implementar o servidor falso do domínio na porta 4000, com projeção dos 4 atores do caso e suporte a pedidos com ETag.
3. Testar via `node --test` e verificar que simula o sistema de negócio perfeitamente.

---

## 2. Estado dos repositórios

```
repos/
  erp-contratos/   45d04af   ✅ publicado @erp/contratos@0.1.0 (SSH)
  erp-nucleo/      b9bbbed   ✅ publicado @erp/nucleo@0.1.0 (SSH, Tasks 5 e 6 concluídas)
  docker-compose.yml         docker compose up -d / down (volume gerenciado repos_verdaccio_storage)
  scripts/registry.mjs       node repos/scripts/registry.mjs up|down (invoca docker compose)
```

`erp-dominio-stub`, `erp-shell` e `erp-mfe-pedidos` ainda **não existem** — são as tasks
7, 8 e 9.

### Serviços

Verdaccio precisa estar no ar em `:4873` antes de qualquer task. Ele é do **controlador**,
não dos subagentes: processo iniciado num dispatch não sobrevive ao seguinte.

```bash
node repos/scripts/registry.mjs up && sleep 8
curl -sf http://localhost:4873/-/ping && echo OK
```

A partir da Task 8 também será preciso segurar stub (`:4000`), shell (`:3000`) e zona
(`:3001`) simultaneamente — e isso é do controlador pelo mesmo motivo.

---

## 3. Estado remoto — tudo salvo

| Onde | O quê |
|---|---|
| `fork` — `wilson-castro/nextjs-mfe` | branch `bff-multizone` |
| `origin` — `ArtroxGabriel/nextjs-mfe` | branch `bff-multizone` |
| `wilson-castro/erp-contratos` (público) | `master` |
| `wilson-castro/erp-nucleo` (público) | `master` |

`.gitmodules` aponta para as URLs HTTPS reais, e um clone limpo do repositório do Gabriel
com `--recurse-submodules` foi verificado: os dois submódulos resolvem com arquivos.

> **Clonar não basta para rodar.** `@erp/contratos` e `@erp/nucleo` só existem publicados
> no Verdaccio **local**. Quem clonar precisa subir o próprio registry
> (`node repos/scripts/registry.mjs up`) e publicar os dois, na ordem contratos → núcleo,
> ou o `pnpm install` das apps não resolve `@erp/*`.

## 4. Decisões pendentes do humano

1. **Repositórios remotos para os submódulos** (§3). Sem isso o código só existe nesta máquina.
2. **Antecipar a segunda zona.** `01-operacao.md` §8.4: uma zona só não testa Multi-Zones —
   hard navigation, portas do `SharedWorker`, `<Link>` silencioso, duplicação de bundle e
   ACL de fragmento só se tornam observáveis com duas. Recomendação registrada: antecipar.
   Muda o roteiro de `00-arquitetura.md` §13.
3. **Módulo Federation restrito à `@erp/ui`** — adiado até haver medição de bytes numa
   travessia. Quem produz a medição é o agente `simulador-condicoes`.
4. **`supportId` cunhado pelo BFF** em vez de aceito do domínio, o que eliminaria a classe
   de vazamento inteira. Não adotado porque mudaria o contrato de C8. Ver
   `00-arquitetura.md` §4.3.

---

## 5. Minors deferidos para a revisão final

Não bloqueiam, mas a revisão final do branch deve triá-los:

- **Task 4** — o laço do teste de namespace passa se `caminhos` ficar vazio; falta asserção
  de tamanho. Hoje não dispara, mas uma guarda futura mais ampla mataria a prova em
  silêncio. É a mesma classe de defeito que este task já teve uma vez.
- **Task 4** — `servidor.close()` sem `try/finally` em dois testes; asserção que falha no
  meio deixa o servidor ouvindo.
- **Task 5** — diretório de sessões criado sem permissão restritiva (os arquivos são
  `0o600`, o diretório herda o umask).
- **Task 5** — TOCTOU entre `existsSync` e `readFileSync` em `sessaoArquivo.ler()`.
- **Task 5** — `pode()` aceita `Partial<PermissoesPedido>`, em tensão com a nota de
  `@erp/contratos` de que o Record é sempre completo. Divergência defensável, merece
  uma linha de docstring.
- **Task 3** — `sanitizarSupportId` é allowlist de formato, não de semântica.

---

### 5.1 Defeitos do plano encontrados na Task 7 (2026-09-15)

- **Guarda anti-navegador bloqueava o próprio BFF.** O plano recusa `Origin` ou `Sec-Fetch-Mode`
  e afirma que o fetch de servidor não manda nenhum dos dois. O fetch do Node 24.7 (undici)
  manda `sec-fetch-mode: cors` em toda requisição: o `upstream()` do núcleo levaria 403 e o C1
  falharia nas Tasks 9/10. A verificação do Step 7 usa `curl`, que não manda o cabeçalho, e por
  isso não pegava. Implementado: `Origin || Sec-Fetch-Site || Sec-Fetch-Dest`. **Divergência em
  aberto:** o spec §6 invariante 3 descreve outro mecanismo (cabeçalho de dev injetado pelo
  adaptador), que exigiria mudar e republicar o `@erp/nucleo`.
- **Uma requisição derrubava o stub.** `decodeURIComponent('%E0')` e `JSON.parse` de corpo
  inválido em `/_dev/revogar` lançavam dentro do listener. Agora 404 e 400, com teste.
- Revisão (revisor-mfe, Sonnet): **APPROVE**. Confirmou as duas correções empiricamente e que a
  guarda nova recusa fetch cross-site, navegação direta, `<img>`/`<script>` e formulário POST.
  Menores corrigidos no commit seguinte: `/pedidos/:id` aceitava POST/PUT/DELETE com 200;
  `projetar()` devolvia referências ao fixture compartilhado.
- **Risco conhecido, herdado do plano:** `/_dev/revogar` não exige credencial; qualquer processo
  local que não mande cabeçalhos de navegador altera os grupos de qualquer ator. Aceito para stub
  de dev (é o gatilho do C7).
- **Decisão pendente (invariante 3):** a guarda é uma denylist de cabeçalhos de navegador e deixa
  passar qualquer chamador que não seja navegador (curl, outro processo local, SSRF). O spec
  promete allowlist positiva (cabeçalho que só o adaptador injeta), que exige acoplar segredo
  entre `erp-nucleo` e o stub e republicar o núcleo. Até decidir, a invariante 3 não pode ser
  marcada como provada: o teste prova outro mecanismo.
- O plano ainda mostra o código antigo da Task 7.

## 6. Lições do processo, para não repetir

- **Regenerar TODOS os briefs após qualquer edição do plano.** Regenerar só os "afetados"
  já deixou um brief congelado numa versão com defeito.
- **`git add -A` na raiz engole sub-repo como gitlink solto.** Usar caminhos explícitos.
- **Não usar `git clean -fdx` na raiz** — destrói `repos/` inteiro.
- Placar até aqui: **5 tasks tocadas, 16 defeitos do plano encontrados, zero erros de
  implementador.** Os revisores acharam coisas que leitura atenta não acha — o `down` que
  não derrubava nada, o `supportId` como canal aberto, o byte de controle que vence os
  guards de prefixo, e o `encodeURIComponent` que não escapa ponto.

---

## 7. O desenho, para contexto

Completo e commitado, em três partes:

| Documento | Responde |
|---|---|
| `docs/design-bff/mfe/00-arquitetura.md` | como a solução é feita |
| `docs/design-bff/mfe/01-operacao.md` | como ela roda, falha e evolui |
| `docs/design-bff/mfe/02-zonas.md` | o que cada time precisa saber |

Spec da fatia 1: `docs/superpowers/specs/2026-09-09-base-mfe-multizone-design.md`
Plano: `docs/superpowers/plans/2026-09-09-base-mfe-fatia-1.md`
Agentes: `.claude/agents/` — arquiteto, revisor, testes-invariantes, simulador-condicoes.
