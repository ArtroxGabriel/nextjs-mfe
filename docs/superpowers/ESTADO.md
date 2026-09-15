# Estado da execução — atualizado em 2026-09-15

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
| 7 — stub de domínio (`erp-dominio-stub`) | ⏸ **próxima tarefa a ser implementada** (porta 4000) |
| 8 a 11 | não iniciadas |

**O ponto exato da parada:** As Tasks 1 a 6 do `@erp/nucleo` e `@erp/contratos` estão 100% implementadas,
testadas e publicadas no registro Verdaccio local (`localhost:4873`). Os submódulos estão configurados via SSH.
O próximo passo imediato é iniciar a **Task 7 (`erp-dominio-stub`)**, conforme especificado em
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
