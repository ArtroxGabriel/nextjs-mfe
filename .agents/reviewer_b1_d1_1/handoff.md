# Relatório de Revisão — Gate B1 + D1 (Iteração 1)

**Revisor:** revisor-mfe (`reviewer_b1_d1_1`)  
**Data:** 2026-09-22  
**Veredito:** **APPROVE**  

---

## 1. Sumário Executivo

A revisão dos itens **B1** (migração para o kit de aplicação no núcleo e na moldura) e **D1** (persistência de sessão no Redis com fail-closed e escritor único) foi concluída com sucesso. 

Todas as 4 aplicações (`repos/erp-shell`, `repos/erp-zona-1`, `repos/erp-zona-2`, `repos/erp-zona-acesso`) foram migradas para utilizar `@erp/nucleo` `0.8.2` e `@erp/moldura` `0.4.0`. As antigas duplicações de lógica em `lib/pagina.ts`, `lib/indisponivel.tsx` e `app/global-error.tsx` foram eliminadas em favor dos kits centralizados `@erp/nucleo/app` e `@erp/moldura/servidor`. A persistência de sessão no Redis (`redis` 6.2.1) respeita rigorosamente o Invariante 15 (shell como escritor único, zonas estritamente como leitoras), hashing SHA-256 de identificador de sessão, expiração alinhada por TTL (`PX`) e comportamento fail-closed normalizado (`ERRO_INTERNO`).

Não foi identificada nenhuma violação aos 17 invariantes de segurança do `AGENTS.md`.

---

## 2. Análise Detalhada dos Itens

### 2.1. B1 — Kit de Aplicação no Núcleo e Moldura

1. **Versões e Lockstep das Dependências:**
   - As 4 aplicações declaram e utilizam:
     - `@erp/nucleo`: `0.8.2`
     - `@erp/moldura`: `0.4.0`
     - `@erp/contratos`: `0.3.1`
   - A verificação de lockstep (`task lockstep`) foi executada e confirmou paridade total entre as 4 apps.
   - O comando `task typecheck` foi executado em todas as 4 apps e passou sem erros de tipagem.

2. **Eliminação de Duplicações de Código:**
   - **`lib/pagina.ts`:**
     - Em todas as 4 apps, o arquivo agora possui apenas 28 linhas, funcionando exclusivamente como um adaptador que injeta as primitivas do Next.js (`headers`, `cookies`, `notFound`, `redirect`, `cache`) em `criarPaginas` (`@erp/nucleo/app`) e `criarMolduraDoServidor` (`@erp/moldura/servidor`).
     - A lógica de decisão de acesso, validação de origem CSRF, `sessaoDaPagina`, `exigirModulo`, `modulosPermitidos`, `flash` e `acaoProtegida` foi 100% centralizada no núcleo e na moldura.
   - **`lib/indisponivel.tsx`:**
     - Arquivos locais redundantes foram completamente removidos de todas as zonas e shell. O componente `ServicoIndisponivel` agora é importado diretamente de `@erp/moldura` e renderizado em `app/layout.tsx` quando `dadosDaMoldura().indisponivel` é `true`.
   - **`app/global-error.tsx`:**
     - O Next.js App Router exige fisicamente a presença de `global-error.tsx` para captura de erros no layout raiz. Cada aplicação agora contém apenas uma linha de delegação limpa:  
       `export { ErroGlobal as default } from '@erp/moldura'`. Toda a lógica visual e estrutural está encapsulada na biblioteca central.

3. **Verificação dos Invariantes de `AGENTS.md` no Escopo B1:**
   - **Invariante 1 (Sem vazamento de tokens para o cliente):**
     - Em `erp-shell/app/api/auth/entrar/route.ts`, o navegador recebe apenas um id de sessão opaco UUIDv4 via cookie `__Host-session` com atributos `httpOnly`, `secure`, `sameSite: 'lax'`, `path: '/'`. Nenhum `access_token` ou `refresh_token` é enviado ao cliente.
   - **Invariante 2 (DTO sensível não é serializado como prop de ilha):**
     - Verificado estaticamente via AST por `base/verificacao/seguranca-estatica.mjs` (regra `P0-dto-sensivel`).
     - No `erp-zona-1/app/zona1/page.tsx`, o componente de cliente `BotaoDeAviso` recebe apenas uma string simples `texto: string`. Em `recursos/[id]/page.tsx`, `recurso` e seu campo `custo` são renderizados estritamente como Server Components.
   - **Invariante 3 (`import 'server-only'` em módulos de servidor):**
     - Presente na linha 1 de todos os arquivos de infraestrutura, sessão e dados: `lib/nucleo.ts`, `lib/pagina.ts`, `lib/redis.ts` (em todas as 4 apps), `erp-zona-1/lib/dominio-a.ts`, e nos subpaths do `@erp/nucleo` (`criarPaginas.ts`, `criarNucleo.ts`, `sessao-redis.ts`, etc.).
     - A regra estática `P0-server-only` garante que nenhuma ilha `'use client'` importe tais módulos.
   - **Invariante 5 & 16 (Server Actions com validação de sessão e módulo no primeiro bloco):**
     - Todas as Server Actions (`erp-zona-2/app/zona2/acoes.ts`, `erp-zona-acesso/app/acesso/acoes.ts`) utilizam o invólucro `acaoProtegida(modulo, ...)`.
     - No `criarPaginas.ts`, `acaoProtegida` executa em ordem estrita:
       1. Validação de origem (`origemPermitida()`: `Origin` do shell e `Sec-Fetch-Site === 'same-origin'`).
       2. Revalidação de sessão (`await nucleo.sessao.exigir()`).
       3. Revalidação de autorização no módulo (`await nucleo.acesso.exigirModulo(modulo, funcionalidade)`).
     - Todas as páginas protegidas chamam `await exigirModulo(...)` como primeira instrução assíncrona. Se não autorizado, emite `notFound()` (HTTP 404). Fail-closed assegurado caso o serviço de acesso falhe.
   - **Invariante 11 (Sem credenciais em `NEXT_PUBLIC_*`):**
     - Aprovado na análise estática `P2-next-public`.
   - **Ausência de `<Link>` cruzando fronteiras de zona:**
     - Analisado pelo AST (`P1-link-entre-zonas`). Todas as navegações entre zonas usam tags HTML `<a href="...">`, impedindo corrupção do roteador client-side do Next.js.

---

### 2.2. D1 — Persistência de Sessão no Redis

1. **Invariante 15 (Escritor único no shell, zonas estritamente leitoras):**
   - `repos/erp-shell/lib/nucleo.ts`: Configurado via `criarNucleoDoShell`, repassando `sessaoRedisDeEscrita({ cliente: clienteRedis })` sob a propriedade `escrita.store`. Apenas o shell cunha IDs, grava e remove sessões (`entrar`, `encerrar`).
   - `repos/erp-zona-1`, `erp-zona-2`, `erp-zona-acesso`: Configurados via `criarNucleo`, repassando apenas `sessaoRedis({ cliente: clienteRedis })`. A interface do leitor expõe unicamente o método `ler(id)`. Nenhuma zona tem acesso aos métodos `gravar` ou `remover`, nem importa `@erp/nucleo/shell`.
   - Verificado estaticamente pelo teste `N3 estatico` em `base/verificacao/base.test.mjs`.

2. **Identificador Opaco e Proteção contra Vazamento de Chaves (Invariante 1):**
   - No adaptador `sessao-redis.ts`, a função de chave é implementada como:
     ```ts
     const chaveDe = (prefixo: string) => (id: string) =>
       `${prefixo}${createHash('sha256').update(id).digest('hex')}`
     ```
   - O id da sessão recebido pelo cookie nunca é salvo de forma crua no Redis. Mesmo em caso de inspeção direta do Redis (`KEYS *`), os cookies originais não podem ser inferidos.
   - O prefixo padrão é `erp:sessao:`, configurável por ambiente.

3. **Alinhamento do TTL com a Expiração da Sessão:**
   - Em `sessaoRedisDeEscrita.gravar(id, s)`:
     ```ts
     const restante = Math.floor(s.expiraEm - Date.now())
     if (restante <= 0) {
       await semVazar(() => cfg.cliente.del(chave(id)))
       return
     }
     await semVazar(() => cfg.cliente.set(chave(id), JSON.stringify(s), { PX: restante }))
     ```
   - A expiração da chave no Redis é definida com precisão em milissegundos (`PX: restante`), alinhada ao campo `expiraEm` da sessão.
   - Sessões vencidas são imediatamente removidas via `del`, prevenindo retenção de chaves zumbis. O próprio Redis se encarrega da limpeza automática com expiração ativa/passiva.

4. **Comportamento Fail-Closed Normalizado (Invariante 12):**
   - Todas as chamadas ao cliente Redis são envolvidas pelo tratador seguro:
     ```ts
     async function semVazar<T>(f: () => Promise<T>): Promise<T> {
       try { return await f() } catch { throw new ErroDeAplicacao('ERRO_INTERNO') }
     }
     ```
   - Caso o Redis esteja fora do ar, recuse conexão ou sofra timeout, o erro é convertido diretamente em `ErroDeAplicacao('ERRO_INTERNO')`.
   - Sob nenhuma hipótese o erro de rede é engolido como "sessão nula", evitando falsos deslogamentos silenciosos em leitura ou gravação inconsistente.
   - Nenhuma informação de infraestrutura (como strings de conexão com credenciais, IPs, portas ou stacktraces) vaza para camadas externas ou para a interface do usuário.
   - Teste unitário correspondente em `erp-nucleo/test/sessao-redis.test.mjs` valida expressamente a rejeição e a ausência de vazamento de credenciais na mensagem de erro.

5. **Resiliência do Cliente Redis:**
   - O wrapper `clientePreguicoso` em `lib/redis.ts` captura erros de evento (`on('error')`) para evitar que falhas assíncronas de conexão derrubem o processo Node.js não tratado, limpando a promessa de conexão para permitir tentativas subsequentes automáticas de reconexão.

---

## 3. Lista de Achados

| ID | Severidade | Descrição | Status / Recomendação |
|---|---|---|---|
| — | — | Nenhum achado impeditivo encontrado. | Aprovado |

### Observações de Qualidade (Informativas)
- **Obs-1 (Simulação de indisponibilidade em ponta a ponta):** O comportamento de fail-closed com Redis fora do ar está coberto por testes unitários detalhados no núcleo (`erp-nucleo/test/sessao-redis.test.mjs`). A extensão dessa prova para o teste de integração ponta a ponta durante o gate challenger/auditor agregará ainda maior robustez à base de regressão.
- **Obs-2 (Padronização de re-export de erro global):** A manutenção de `app/global-error.tsx` de 1 linha com re-export de `@erp/moldura` atende com precisão cirúrgica às restrições do compilador do Next.js App Router, sem violar a regra de eliminação de código duplicado.

---

## 4. Veredito Final

**APPROVE**

As implementações de **B1** e **D1** satisfazem integralmente os critérios funcionais, de segurança e arquiteturais estabelecidos no plano e em `AGENTS.md`. A base está pronta para prosseguir para os testes de mutação/ataque e as etapas subsequentes do roadmap.
