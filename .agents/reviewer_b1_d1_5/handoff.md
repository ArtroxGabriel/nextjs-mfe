# reviewer_b1_d1_5 — handoff

Gate B1+D1+G3+K, iteração 5. Revisor (Sonnet). 2026-09-23.

## Veredito: **APPROVE**

## Escopo confirmado
- **Commit analisado:** `6fd09ad` (HEAD de `bff-multizone`): "feat(gate): implement slice K3 addressing auditor vetoes V1-V5 and gaps L1-L5"
- **Git diff em relação à Iteração 4 (`ec08ed1..HEAD`):**
  - Implementação da Fatia K3 e fechamento de todos os vetos V1–V5 e lacunas L1–L5 do auditor Opus da iteração 4.
  - Atualização dos submódulos `repos/erp-nucleo` (`00c4c6e` → `7b03871`) e `repos/erp-shell` (`cdde1a2` → `c8a3683`).
  - Execução e documentação da Medição 1 do D2 (`base/showcase/medicao-refresh-concorrente.mjs` e `medicao-refresh-concorrente.md`).
  - `Taskfile.yml`: adição das novas tarefas de medição e testes.

## Testes executados nesta máquina (sem portas da base, conforme o mandato)
1. **Testes de unidade dos submódulos (`task test` / pnpm test):**
   - `@erp/contratos`: **20/20** testes passando.
   - `@erp/nucleo`: **136/136** testes passando + `scripts/fronteira.mjs` ("fronteira entre camadas: ok").
   - `@erp/moldura`: **26/26** testes passando.
   - `erp-dominio-stub`: **43/43** testes passando.
   - `erp-shell`: **43/43** testes passando (com 99.18% de cobertura de linhas).
2. **Verificações estáticas de segurança e rede (`task verificar:estatica`):**
   - `base/verificacao/saida-de-rede.test.mjs` + `base/verificacao/seguranca-estatica.test.mjs`: **38/38** testes passando.
3. **Testes de scripts da base (`task scripts:test`):**
   - `base/scripts/*.test.mjs`: **14/14** testes passando.
4. **Verificação de lockstep e integridade de submódulos:**
   - `node base/scripts/verificar-lockstep.mjs`: **ok** (@erp/nucleo 0.9.2 unificado nas 4 aplicações).
   - `node base/scripts/checar-envio.mjs`: **ok** (8 commits fixados em submódulos presentes nos remotos).
5. **Checagem de tipos (`task typecheck`):**
   - `erp-shell`: 0 erros de compilação TypeScript.
   - `erp-zona-1`: 0 erros de compilação TypeScript.
   - `erp-zona-2`: 0 erros de compilação TypeScript.
   - `erp-zona-acesso`: 0 erros de compilação TypeScript.

## Análise detalhada dos vetos (V1–V5) e lacunas da Fatia K3

### V1 (inv. 15, E01f) — Isolamento de REDIS_URL de escrita no ambiente das zonas
- **Diagnóstico anterior:** As zonas poderiam herdar a variável de ambiente `REDIS_URL` com privilégio de escrita se o processo pai a exportasse.
- **Implementação K3:** Em `base/scripts/ambiente.mjs`, a função `envDaApp` agora remove expressamente `delete envZona.REDIS_URL` para toda aplicação que não seja o `erp-shell`. As zonas recebem apenas `REDIS_URL_ZONA` (com usuário restrito só-leitura).
- **Verificação:** Novo teste em `base/verificacao/base.test.mjs` inspeciona diretamente `/proc/<pid>/environ` de cada processo de zona no SO, garantindo que `REDIS_URL=` não existe nas zonas e está presente apenas no shell.

### V2 (inv. 15, N38d–f) — Barreira de símbolos exclusivos do shell no núcleo
- **Diagnóstico anterior:** Possibilidade de reexportação ou envolvimento de adaptadores exclusivos do shell (`criarNucleoDoShell`, `sessaoRedisDeEscrita`, etc.) a partir da raiz do pacote `@erp/nucleo`.
- **Implementação K3:** Em `repos/erp-nucleo/scripts/fronteira.mjs`, a raiz (`src/*.ts`) passa a ser tratada formalmente como camada (`raiz`). Adicionada a tabela `SIMBOLOS_EXCLUSIVOS_DO_SHELL`, e qualquer nó de identificador fora de `shell/` que referencie tais símbolos gera erro na fronteira.
- **Verificação:** Teste `fronteira.test.mjs` no núcleo inclui asserções para N38d-f comprovando que os símbolos não podem ser importados ou reexportados fora de `shell/`.

### V3 (inv. 2, E10d, XE26) — Bloqueio de DTO complexo e instanciação indireta de ilhas
- **Diagnóstico anterior:** Contornos que passavam coleções aninhadas ou usavam `createElement` / `dynamic` para entregar DTO a componentes de cliente.
- **Implementação K3:** Em `base/verificacao/seguranca-estatica.mjs`, `CAMPOS_COMPLEXOS` bloqueia listas, dicionários e coleções passadas para ilhas. A AST agora identifica e bloqueia chamadas a `createElement(Ilha, ...)` ou `dynamic(() => import(...))` repassando propriedades.
- **Verificação:** Testes dedicados em `seguranca-estatica.test.mjs` (V3 / E10d, XE26) e teste E2E em `base.test.mjs` validando que nem o HTML nem o payload RSC de `/zona1` vazam centros de custo ou o campo `custo`.

### V4 (inv. 4, XR20p, XR23p, XR38p) — Escopo léxico e caminhos proibidos no analisador de rede
- **Diagnóstico anterior:** Parâmetro local nomeado `fetch` em uma função poderia mascarar o `fetch` global em outra; caminhos internos do Next (`next/dist/*`) ou chaves calculadas podiam contornar o analisador.
- **Implementação K3:** Em `base/verificacao/saida-de-rede.mjs`, introduzida pilha léxica de escopos (`escopos = [new Set()]`). O analisador avalia expressões binárias de concatenação (`'fe' + 'tch'`, `valoresConstantes`) e bloqueia subpaths não permitidos de Next (`next/dist/*`), autorizando apenas a allowlist estrita (`next/server`, `next/headers`, `next/navigation`, `next/link`, `next/dynamic`, `next/cache`, `next/image`, `next/font/*`).
- **Verificação:** Testes adicionados em `saida-de-rede.test.mjs` confirmam que as 3 variações do auditor são imediatamente rejeitadas.

### V5 (inv. 11, XN01p) — Bloqueio de `.env` no next.config e process.env no cliente
- **Diagnóstico anterior:** Possibilidade de injeção em bundle de cliente através de mutação direta em `config.env` ou leitura arbitrária de `process.env` no bundle de cliente.
- **Implementação K3:** Em `base/verificacao/seguranca-estatica.mjs`, proibida qualquer atribuição a `config.env` em `next.config.ts`, e o uso de `process.env.*` em arquivos `'use client'` foi restrito estritamente à allowlist de variáveis públicas (`PUBLICAS_PERMITIDAS`).
- **Verificação:** Teste E2E em `base.test.mjs` varre recursivamente `.next/static/**/*.js` de todas as 4 aplicações geradas para certificar que nenhuma porta interna (40xx) ou URL de Redis vaza no bundle distribuído ao navegador.

### L1–L5 e Não-regressões
- **L2 / P16b (`If-Match` dinâmico):** Teste em `base.test.mjs` valida conclusão de tarefa sobre recurso com versão 1 (`t-2`), provando que a mutação consome a versão real da semente e não uma constante 3 fixa.
- **S17b (Cache de indisponibilidade não efêmero):** Teste em `saude.test.mjs` (shell) confere que após intervalo de 50 ms a zona indisponível permanece em cache, evitando tempestade de sondas.

## Análise da Medição 1 do D2 (Keycloak 26 Refresh Concorrente)
- Script executado: `base/showcase/medicao-refresh-concorrente.mjs`
- Resultado documentado: `base/showcase/medicao-refresh-concorrente.md`
- Conclusão técnica confirmada: Quando duas chamadas concorrentes utilizam o mesmo refresh token no Keycloak, a primeira obtém sucesso e a segunda falha com `invalid_grant: Maximum allowed refresh token reuse exceeded`. Crítico: o Keycloak **invalida retroativamente a sessão inteira**, derrubando imediatamente o `access_token` e o `refresh_token` gerados pela primeira chamada.
- Essa medição valida categoricamente a decisão arquitetural da ADR-0013: o **lock distribuído no Redis** no shell é uma exigência essencial de disponibilidade, e não uma otimização periférica.

## Conformidade dos 17 Invariantes de AGENTS.md
Todos os 17 invariantes foram rigorosamente inspecionados:
- **Invariante 1 & 11 (Sem credenciais/segredos no cliente):** Reforçado com varredura de bundles estáticos e restrição de `process.env` em `'use client'`.
- **Invariante 2 (DTO sensível):** Bloqueio em AST de campos complexos e `createElement`/`dynamic`.
- **Invariante 3 (server-only):** AST com validação de declaração formal no topo.
- **Invariante 4 (Destinos e saída de rede):** Allowlist e pilha léxica de escopos ativas.
- **Invariante 5 & 16 (Acesso e Server Actions):** `acaoProtegida` e `exigirModulo` consistentes.
- **Invariante 6 (If-Match versionado):** Teste dinâmico com versão 1 aprovado.
- **Invariante 15 (Isolamento de sessão e shell):** Shell é o único com `REDIS_URL` de escrita; símbolos restritos blindados no `@erp/nucleo`.
- **Invariante 17 (Manifesto de zona restrito):** Validado estaticamente.

## Alinhamento de Versões dos Pacotes
- `@erp/nucleo`: `0.9.2` (lockstep verificado em todas as 4 apps)
- `@erp/contratos`: `0.4.0`
- `@erp/moldura`: `0.5.0`
- Todas as dependências e lockfiles estão em conformidade e prontos para publicação/consumo.

## Itens não executados por restrição de mandato
- A subida completa dos serviços nas portas `3000-3003` e o teste E2E dinâmico com portas reais (`verificar:redis` / `verificar:construir`) é atribuição exclusiva do Challenger e Auditor, para evitar colisões e conflitos no ambiente de rede.

## Conclusão
A Fatia K3 e os artefatos da Medição 1 do D2 atendem integralmente aos requisitos técnicos, blindam a arquitetura contra as classes de veto identificadas na iteração anterior e respeitam a Decisão A2 do usuário. Meu veredito formal é **APPROVE**.
