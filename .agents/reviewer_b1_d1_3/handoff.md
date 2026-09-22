# Handoff reviewer_b1_d1_3

Iniciado: 2026-09-22. Concluído.

## Escopo lido
AGENTS.md (invariantes 1-17, com 16/17 reescritos), LEIA-PRIMEIRO.md, ADR-0014 (+ adendo 1),
GATE_STATUS.md (iteração 2 reprovada, V1-V8), RETOMADA.md (tabela "Fatia K concluída").

## Diffs revisados
Principal `7b10eae..HEAD`: AGENTS.md, Taskfile.yml, base/scripts, base/showcase, base/verificacao,
docs/CONFIGURACAO.md, docs/adr/0014.
Submódulos (do commit fixado em 7b10eae ao HEAD atual):
- erp-contratos 2c9ad84->b56320e (0.4.0): AcessoEfetivo/ModuloEfetivo, ManifestoDeModulo v2,
  validação de namespace mantida no v1 e criada no v2.
- erp-nucleo 2c79c38->969b1b0 (0.9.0->0.9.2): corte seco v2 (acessoHttp/reduzirEu), exigirModulo(modulo,
  funcionalidade) e exigirPapel, fronteira.mjs por import real (AST, sem comentário), ClienteRedisDeLeitura,
  entradaInicial, tetos em lerNumeroPositivo.
- erp-moldura e467eda->a875c21 (0.5.0): acaoProtegida repassa Requisito completo ({modulo,funcionalidade}
  ou {administra:true}).
- erp-dominio-stub 412cb11->064dccf: mock v2 aceita token dev, nome no /v2/eu, ana..davi na unidade central,
  403 quando id do manifesto != serviço.
- erp-shell ed599a4->46237f7: sonda só 2xx, "/" não é mais módulo (fail-closed por modulosPermitidos()).
- erp-zona-1/2/acesso: nucleo 0.9.2, lib/redis.ts só com `get` via REDIS_URL_ZONA (ACL leitura).

## Verificado
1. Vetos/lacunas V1-V8, L1-L8 da iteração 2: todos com correção e teste específico localizado e lido
   (base.test.mjs "V1 estatico"/"V1 dinamico" com AUTH+SET+DEL via RESP cru contra o Redis real, fronteira.test.mjs
   para V2/V3, acesso.test.mjs do núcleo para V4/V6/L6, seguranca-estatica.test.mjs E07-E22 para V5/V7,
   saida-de-rede.test.mjs R01-R07 para V8, shell saude.test.mjs U3/L3/L2 para L1-L2).
2. Invariantes 1,2,3,4,7,8,9,13,15,16,17: código lido caso a caso (acesso-http.ts, acesso-v2.ts,
   criarPaginas.ts, criarNucleo.ts, servidor.ts da moldura, page.tsx/acoes.ts da zona-acesso).
   `reduzirEu` derruba CPF/papéis antes de qualquer página ver o resultado; `acaoProtegida` faz
   origem->sessão->requisito nessa ordem; erro normalizado por MENSAGENS[codigo].
3. `scripts/fronteira.mjs`: PERMITIDO mantém interno sem acesso a adaptadores/fabricas; server-only
   por AST (não regex ingênuo), com teste que reprova comentário.
4. ADR-0014 adendo 1: corte seco confirmado (sem fallback v1, teste "v2 com X: erro, nunca lista, nunca
   404, nunca a v1" para 401/403/500/404/timeout/corpo malformado); exigirModulo/exigirPapel com as
   assinaturas do adendo; manifesto v2 sem CPF/papéis; namespace de funcionalidade verificado
   estaticamente ("toda funcionalidade que a zona exige esta no manifesto dela").
5. `seguranca-estatica.mjs`/`saida-de-rede.mjs`: sem falso negativo óbvio nas regras endurecidas
   (AST real, resolve import local/dinâmico/reexportação); ver achado 1 abaixo sobre `valorSeguro`.

## Testes rodados nesta máquina
- `task test`: contratos 20/20, núcleo 132/132, moldura 26/26, stub 42/42, shell 40/40 — bate com RETOMADA.md.
- `task verificar:estatica`: 23/23.
- `task scripts:test`: 12/12.
(Não rodei `task verificar*` nem subi portas — meu escopo é leitura e teste de unidade/estático.)

## Veredito: APPROVE (com 2 observações não bloqueantes)

Nenhum invariante violado nos diffs revisados; todos os vetos e lacunas da iteração 2 têm correção
com teste que reprovaria a regressão; adendo 1 do ADR-0014 seguido à risca (assinaturas, corte seco,
sem CPF/papel serializado, manifesto v2).

### Achados (nenhum bloqueante)

1. **Suspeita, não confirmada como explorável** — `repos/erp-zona-1/lib/redis.ts:22` (e zona-2,
   zona-acesso, mesma linha): `const url = process.env.REDIS_URL_ZONA ?? process.env.REDIS_URL`.
   Se `REDIS_URL_ZONA` não estiver definido em produção mas `REDIS_URL` estiver, a zona conecta ao
   Redis com a credencial de escrita do shell — a segunda camada de defesa (ACL só-leitura) cai
   silenciosamente, restando só a primeira (o tipo `ClienteRedisDeLeitura` não expõe `set`/`del`
   em nenhum código de zona, confirmado por grep). `docs/CONFIGURACAO.md` já documenta
   "fora da máquina local, obrigatório", mas nada falha a subida se a variável faltar.
   Não é regressão desta iteração (mesmo padrão de fallback já existia para `REDIS_URL` antes do D1)
   e não há caminho de código que escreva com essa credencial hoje. Confirmaria: um teste que suba
   a zona com `REDIS_URL` setado e `REDIS_URL_ZONA` ausente e cheque erro na subida (fail-closed),
   em vez de reuso silencioso.
2. **Observação de leitura, não achado** — `repos/erp-nucleo/src/interno/acesso-v2.ts:29`:
   `administra: corpo.papeis.length > 0` trata qualquer papel (`gestor-unidade`, `auditor-modulo`
   etc.) como "administra", não só `admin-geral`. Conferido contra o mock (`/v2/eu` devolve
   `papeis: papeisDe(e, p.id)`, todos os tipos de atribuição do modelo são administrativos, nenhum
   é módulo/perfil funcional) — condiz com o modelo de referência, não é vazamento de autoridade.
   Deixo registrado porque o nome do campo sugere "admin-geral" e pode confundir revisão futura.

### Falso positivo/negativo em `base/verificacao`
Nenhum encontrado nos analisadores lidos linha a linha. Ponto que fica como possível folga teórica em
`seguranca-estatica.mjs` (`valorSeguro`, por volta da função homônima): um identificador só é "seguro"
por estar em `importados` (import de outro módulo), sem checar se o módulo importado exporta um DTO
não projetado — teoricamente um `import { pedidoCompleto } from './dados'; <Ilha dado={pedidoCompleto}/>`
passaria. Não encontrei esse padrão em nenhuma app real; é hipótese, não achado confirmado.

Nada aqui reprova o gate. As duas notas acima são candidatas a endurecimento, não bloqueio.
