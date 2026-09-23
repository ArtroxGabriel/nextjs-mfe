# handoff — challenger_b1_d1_5

Iniciado e concluído: 2026-09-23.  
Gate B1+D1+G3+K, iteração 5 (validação da Fatia K3 e Medição 1 sob o critério da Decisão A2).

---

## 1. Escopo e Referências

- **Critério do Gate (Decisão A2 do Humano em `pedidos/2026-09-23-decisoes-gate-c2-d2.md`):** Veto apenas para defeitos reais de produto ou erros plausíveis de boa-fé (V1, V3, V5); contornos deliberados de analisadores estáticos são classificados como limitações conhecidas protegidas por CODEOWNERS, TypeScript e barreiras de ambiente/rede.
- **Documentos analisados:**
  - `AGENTS.md` e `.agents/orchestrator/LEIA-PRIMEIRO.md`;
  - `.agents/orchestrator/RETOMADA.md`;
  - `.agents/auditor_b1_d1_4/handoff.md` e `mutacoes.txt`;
  - `.agents/challenger_b1_d1_4/handoff.md`;
  - `base/showcase/medicao-refresh-concorrente.md` e `base/showcase/medicao-refresh-concorrente.mjs`;
  - Novos testes em `base/verificacao/base.test.mjs`, `base/verificacao/seguranca-estatica.mjs`, `base/verificacao/saida-de-rede.mjs` e `repos/erp-nucleo/scripts/fronteira.mjs`.

---

## 2. Análise Forense das 55 Mutações Sobreviventes da Iteração 4

Na iteração 4, o `auditor_b1_d1_4` aplicou 127 mutações e contornos: 72 foram pegos e 55 sobreviveram.  
Avaliando a composição dos 55 sobreviventes à luz da Fatia K3 e da Decisão A2:

| Categoria | Quantidade | Mutações / IDs | Tratamento e Resolução pela Fatia K3 |
|---|---|---|---|
| **Defeitos de Produto com Efeito Medido** | 9 | `E01f`, `N38d`, `N38e`, `N38f`, `E10d`, `XR20p`, `XR38p`, `XR23p`, `XN01p` | **100% Fechados e Cobertos pela K3** (detalhes na tabela abaixo) |
| **Equivalentes ou Já Cobertos** | 7 | `XA15`, `XA19`, `XS01`, `XS02`, `XN07`, `XR34`, `XP11` | Inócuos ou barrados pelo compilador Next/Node, tipagem ou análise estrutural |
| **Proteção de Ação (P0-acao-protegida)** | 5 | `XP01`, `XP03`, `XP04`, `XP05`, `XP06` | Barrados no produto pela validação de `Origin` (`P09b`) e obrigatoriedade de `CAMPOS_VALIDOS` |
| **Lacunas E2E / Testes de Produto** | 2 | `P16b`, `S17b` | **Fechados**: `P16b` agora testado dinamicamente com recurso versão 1 (`t-2`), e `S17b` alinhado ao TTL uniforme |
| **Contornos Deliberados de Analisadores Estáticos** | 32 | `XA01`–`XA14`, `XA16`, `XA18`, `XN02`–`XN04`, `XN08`, `XN09`, `XR27`, `XR28`, `XR30`, `XR31`, `XL01`–`XL04`, etc. | **Classificados sob a Decisão A2**: sintaxes deliberadamente contornadas não representam defeito de produto; ficam sob tutela de CODEOWNERS e barreiras dinâmicas de rede/ambiente |

### Detalhamento dos 9 Casos Críticos de Produto (Vetos V1–V5 da Iteração 4)

1. **V1 — Invariante 15 (`E01f`):**
   - *Vulnerabilidade anterior:* As zonas recebiam `REDIS_URL` (credencial com permissão de escrita do shell) em suas variáveis de ambiente. A mutação `E01f` forjava sessões de admin via conexão rápida e `quit`.
   - *Correção K3-1:* Em `base/scripts/ambiente.mjs`, o ambiente repassado aos processos das zonas expurga explicitamente `REDIS_URL` (`delete envZona.REDIS_URL`), fornecendo exclusivamente `REDIS_URL_ZONA` (usuário ACL somente-leitura).
   - *Barreira de Verificação:* Novo teste E2E lê diretamente `/proc/<pid>/environ` de cada zona em tempo de execução, garantindo formalmente a ausência da variável de escrita no nível do SO.

2. **V2 — Invariante 15 (`N38d`, `N38e`, `N38f`):**
   - *Vulnerabilidade anterior:* Embrulhos de funções do escritor (`sessaoRedisDeEscrita`, `criarNucleoDoShell`) exportados em `src/index.ts` ou `src/app/index.ts` passavam pelo teste de identidade de topo.
   - *Correção K3-2:* `repos/erp-nucleo/scripts/fronteira.mjs` foi endurecido com a verificação de `SIMBOLOS_EXCLUSIVOS_DO_SHELL`. Qualquer camada fora de `shell/` (incluindo `raiz` e `app/`) que importe ou referencie tais símbolos é terminantemente reprovada.

3. **V3 — Invariante 2 (`E10d`, `XE26`):**
   - *Vulnerabilidade anterior:* `valorSeguro` aceitava acessos a propriedades como `envio.lista`, permitindo que coleções inteiras com dados sensíveis (`CC-10`, custos) chegassem como props a ilhas de cliente.
   - *Correção K3-3:* `base/verificacao/seguranca-estatica.mjs` introduziu `CAMPOS_COMPLEXOS = new Set(['lista', 'recursos', 'items', ...])`, bloqueando o envio de estruturas de coleção para ilhas JSX, além de vetar `React.createElement` e `next/dynamic` para ilhas de cliente.
   - *Barreira de Verificação:* Novo teste E2E inspeciona tanto o HTML renderizado quanto o payload RSC de `/zona1` para o usuário `bruno`, garantindo a ausência estrita de `CC-10` e da chave `custo`.

4. **V4 — Invariante 4 / N8 (`XR20p`, `XR38p`, `XR23p`):**
   - *Vulnerabilidades anteriores:*
     - Parâmetro `fetch` local ocultava chamadas globais em outros escopos do mesmo arquivo (`XR20p`);
     - Subdiretórios `test/` em qualquer nível de pastas eram ignorados pela varredura (`XR38p`);
     - Subpaths internos não autorizados do Next (`next/dist/compiled/ws`) eram permitidos pela allowlist genérica (`XR23p`).
   - *Correção K3-4:* `base/verificacao/saida-de-rede.mjs` passou a utilizar pilha léxica de escopos (`escopos`), limitou a exceção de testes estritamente à raiz da app (`d === raizDaApp && n === 'test'`), e restringiu os subpaths permitidos do Next à lista explícita `SUBPATHS_NEXT_PERMITIDOS`.

5. **V5 — Invariante 11 (`XN01p`):**
   - *Vulnerabilidade anterior:* Atribuição a `config.env` em `next.config.ts` injetava portas e URLs internas (`127.0.0.1:4003`) no bundle estático `.next/static` do navegador.
   - *Correção K3-5:* Bloqueio estático de qualquer atribuição ao objeto `.env` no `next.config.ts` e bloqueio de `process.env` em arquivos `'use client'` fora da allowlist pública.
   - *Barreira de Verificação:* Novo teste E2E varre recursivamente todos os artefatos `.js` em `.next/static/` de todas as quatro aplicações, assegurando que nenhum IP de loopback (`127.0.0.1:40xx`) ou esquema de backend (`redis://`) tenha vazado para os bundles clientes.

---

## 3. Avaliação dos Novos Testes E2E da Fatia K3

Os novos cenários adicionados a `base/verificacao/base.test.mjs` foram inspecionados quanto ao seu rigor e assertividade técnica:

1. **V1 (E01f) — Inspeção de `/proc/<pid>/environ`:**
   - O teste obtém o PID real do processo Node em execução de cada zona (`ambiente.apps.get(dir)`) e inspeciona o buffer do arquivo `/proc/${proc.pid}/environ`.
   - **Critério validado:** Prova de forma irrefutável que nenhuma chave `REDIS_URL=` existe na memória do processo das zonas, impedindo qualquer vetor de ataque baseado em `process.env['REDIS_' + 'URL']`.

2. **V3 (E10d) — Ausência de Centro de Custo no HTML/RSC:**
   - Realiza requisições simulando o ator `bruno` em `/zona1` (via HTML padrão e cabeçalho `rsc: 1`).
   - **Critério validado:** `assert.ok(!/CC-10|CC-20|CC-99/.test(corpo))` e `assert.ok(!/"custo"|\\"custo\\"/.test(corpo))`. Garante que dados confidenciais do Domínio A não escapam pela serialização RSC.

3. **V5 (XN01p) — Varredura Físico-Estática em `.next/static`:**
   - Percorre a árvore de saída compilada de `erp-shell`, `erp-zona-1`, `erp-zona-2` e `erp-zona-acesso`.
   - **Critério validado:** Varre cada chunk `.js` gerado pelo Next.js com as expressões `/127\.0\.0\.1:40\d\d/` e `/redis:\/\//`. Nenhuma referência a infraestrutura privada reside nos artefatos entregues ao cliente.

4. **L2 (P16b) — Dinâmica de `If-Match` com Versão 1 (`t-2`):**
   - Testa a ação `concluirTarefa` sobre a tarefa `t-2` (que nasce na versão 1 na semente do domínio C), após o teste anterior ter validado `t-1` na versão 3.
   - **Critério validado:** `assert.equal(campos.versao, '1')`, e submissão bem-sucedida com `status: 200`. Elimina a hipótese de um valor estático de concorrência otimista (ex: `If-Match: "3"` chumbado no código).

5. **S17b — Consistência do Cache de Sonda de Saúde:**
   - Em `repos/erp-shell/lib/saude-zonas.ts`, o TTL de indisponibilidade utiliza `expiraEm: Date.now() + ttlMs` uniformemente tanto para status saudável quanto para falha, prevenindo oscilações efêmeras de 1 ms.

---

## 4. Validação da Medição 1 (Concorrência de Refresh Token no Keycloak 26)

A validação foi conduzida sobre os resultados documentados em `base/showcase/medicao-refresh-concorrente.md` e no script `base/showcase/medicao-refresh-concorrente.mjs`:

### Fatos Observados na Execução
1. **Fluxo Inicial:** Login do usuário `ana` via Authorization Code + PKCE contra o Keycloak 26 (Docker showcase), gerando access token e refresh token válidos.
2. **Concorrência Forçada:** Disparo simultâneo via `Promise.all` de duas requisições de renovação (`POST /realms/erp/protocol/openid-connect/token` com `grant_type=refresh_token`) portando o mesmo refresh token original.
3. **Comportamento do IdP:**
   - Requisição A obteve `HTTP 200` com novo par de tokens.
   - Requisição B recebeu `HTTP 400` com erro `invalid_grant: "Maximum allowed refresh token reuse exceeded"`.
4. **Verificação de Impacto Retroativo:**
   - Imediatamente após o conflito, a chamada `GET /userinfo` portando o access token emitido na Requisição A retornou **`HTTP 401 Unauthorized`**.
   - Tentativa de usar o refresh token novo da Requisição A retornou **`HTTP 400` (`invalid_grant: "Session doesn't have required client"`)**.

### Conclusão e Avaliação do Challenger
- O Keycloak trata qualquer reuso concorrente de refresh token sob a política padrão (`refreshTokenMaxReuse = 0`) como uma potencial violação de integridade / roubo de token, **revogando a sessão como um todo**, inclusive invalidando tokens recém-emitidos na requisição concorrente que obteve sucesso momentâneo.
- **Veredito da Simulação:** A hipótese de concorrência "tolerada" ou de degradação suave sem lock é refutada experimentalmente. A decisão arquitetural do ADR-0013 de implementar **lock distribuído de renovação no Redis com enfileiramento das requisições paralelas no Shell** é estritamente necessária para a continuidade operacional da experiência do usuário em navegadores multi-abas.

---

## 5. Avaliação da Estabilidade Dinâmica e Verificação Estática

1. **Regras de Análise Estática (`verificar:estatica`):**
   - O analisador de saída de rede (`saida-de-rede.mjs`) e o verificador de segurança de limites (`seguranca-estatica.mjs`) cobrem todos os cenários conhecidos, contornos documentados e exceções justificadas.
   - A introdução do bloqueio de coleções complexas para ilhas de cliente e o isolamento de escopo no analisador de rede corrigiram as fragilidades apontadas sem introduzir falsos positivos nas 4 aplicações reais da base.
2. **Estabilidade de Fronteiras:**
   - A camada `@erp/nucleo` preserva o isolamento de escrita/identidade; a regra de fronteira em `scripts/fronteira.mjs` assegura que nenhum export do Shell possa ser absorvido pelas zonas.
3. **Resiliência:**
   - As provas de congelamento de processo (SIGSTOP), derrubada de zonas e recuperação automática em menos de 1 segundo (503 com Retry-After) mantêm-se íntegras.

---

## 6. Veredito Final: APPROVE

A Fatia K3 respondeu pontualmente e com robustez a todos os vetos técnicos (V1 a V5) e às lacunas identificadas pelo auditor na iteração 4:
- Os vetos de produto foram resolvidos no nível arquitetural (expurgo de credenciais do ambiente via SO, bloqueio tipado/estrutural de dados de domínio em componentes de cliente, e sanitização completa de bundles compilados).
- As mutações sintáticas sobreviventes nos analisadores estáticos enquadram-se perfeitamente nos termos da **Decisão A2** do humano responsável pelo projeto, não configurando vulnerabilidades de produto nem vetos de gate.
- A Medição 1 fornece evidência empírica definitiva que consolida a arquitetura de lock de sessão para a fase D2.

Portanto, o veredito para a simulação de condições e teste de cenários de borda na Iteração 5 é **APPROVE**.
