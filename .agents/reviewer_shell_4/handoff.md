# reviewer_shell_4: gate "Shell novo", iteração 4

**Veredito: APPROVE**

Escopo: correção pós-veto do auditor_shell_3, só em verificação (`git log -1 -p -- base/`, commit 88c9f76):
`base/verificacao/base.test.mjs` (L1 com `/zona1/recursos/r-1`, teste de completude por varredura de `page.tsx`,
L7 zona travada, L8 nonce, comentário do L4) e `base/scripts/ambiente.mjs` (`congelarApp`/`descongelarApp`).
Nenhum código de produto mudou (confirmado pelo diff: só `base/`). Não toquei nas portas 3000–3003/4001–4004/4010
nem rodei `base/verificacao`, como instruído.

## O que verifiquei

### 1. Teste de completude do L1 (V1) prova o que diz
`find repos/erp-zona-{1,2,acesso}/app -name page.tsx` dá exatamente 5 páginas: `/zona1`, `/zona1/relatorios`,
`/zona1/recursos/[id]`, `/zona2`, `/acesso`. `CONTEUDO_DE_MODULO` agora tem exatamente essas 5 entradas (a nova é
`'/zona1/recursos/r-1'`). Segui a derivação rota→regex do teste (`base/verificacao/base.test.mjs:407-425`):
- Para `zona1/recursos/[id]/page.tsx` a rota vira `/zona1/recursos/[id]` e o padrão
  `^/zona1/recursos/[^/]+$` casa com a chave `/zona1/recursos/r-1`. Confirmado à mão.
- A exclusão de `(publico)` só descarta uma pasta com esse nome exato, em qualquer nível (a recursão retorna `[]`
  só para `n === '(publico)'`); outros route groups são atravessados e removidos do nome da rota pelo filtro
  `!/^\(.*\)$/`. Hoje nenhuma zona tem pasta `(publico)`, então a exclusão é inerte — não mascara nada agora, é
  preparação para quando existir.
- O shell fica de fora da varredura por decisão documentada no comentário (a página dele já se autoverifica
  chamando `modulosPermitidos()` de novo); não é uma lacuna nova, é a mesma equivalência que o auditor já provou.
- `grep exigirModulo` confirma as 5 páginas realmente chamam `exigirModulo`, e todas as 5 têm entrada — o teste de
  completude cobre exatamente a superfície real hoje.

Não é um teste que passa por engano: ele é um teste de metadado (garante que toda página real tem uma entrada no
mapa), separado dos testes comportamentais que já existiam (`L1/V1` itera `CONTEUDO_DE_MODULO` para todo usuário com
a gestão de acesso fora; `L1 tem dentes` confere que quem tem o módulo realmente vê o conteúdo — o `donos` map ganhou
`'/zona1/recursos/r-1': 'bruno'`). Conferi a página do recurso (`repos/erp-zona-1/app/zona1/recursos/[id]/page.tsx`)
e o dado do domínio (`repos/erp-dominio-stub/src/dominio-a.mjs:13`, `r-1` com `custo.centro: 'CC-10'`): o regex
`/Identificador:|CC-10/` tem dentes de verdade, não é um texto genérico que qualquer resposta satisfaria.

Único ponto de generalização não coberto (não bloqueia, é observação para o futuro): a heurística de rota não trata
parallel routes (`@slot`) nem interceptação (`(.)pasta`) — não existem hoje na base, então não é um achado, é uma
lacuna latente da própria heurística de varredura.

### 2. `congelarApp`/`descongelarApp` (V2) — não deixa processo parado
- `congelarApp` roda **antes** do `try`; o `try/finally` do teste L7 (`base.test.mjs:518-527`) garante que
  `descongelarApp('erp-zona-2')` executa mesmo se os `assert` dentro do `try` lançarem (semântica padrão de
  `try/finally`: falha de asserção também aciona o `finally`). Testei o raciocínio, não apenas assumi.
- Ordem de execução importa e está certa: o teste anterior que derruba a zona 2 (`derrubarApp`, linha ~494) tem seu
  próprio `finally` com `subirApp('erp-zona-2')`, que repovoa `apps.set('erp-zona-2', …)` antes do L7 rodar — então
  `congelarApp` nunca encontra `apps.get('erp-zona-2')` indefinido na ordem real dos testes (node:test roda os testes
  de nível superior de um arquivo sequencialmente, sem `concurrency` declarado aqui; confirmado por `grep` que não há
  `concurrency`/`describe` no arquivo).
- Sinal certo: `iniciar()` usa `spawn(..., { detached: true })`, o mesmo padrão que `derrubarApp`/`derrubarDominio`
  já usam com SIGKILL — se o grupo capturasse só o `pnpm` e não o `next start` real, o SIGKILL das iterações
  anteriores (já auditado como matando a zona de verdade, conexão recusada) não teria funcionado. SIGSTOP/SIGCONT no
  mesmo `-pid` herda essa mesma garantia.
- `after(() => ambiente?.derrubar())` no fim do arquivo (linha 25) só manda SIGTERM; se um processo ficasse
  congelado (SIGSTOP) até esse ponto, SIGTERM ficaria pendente até um SIGCONT — mas isso só aconteceria se o
  `finally` do L7 não rodasse, o que exigiria o processo Node do runner morrer no meio (SIGKILL externo, OOM). Risco
  residual aceitável, inerente a qualquer uso de SIGSTOP em teste, não uma falha do código revisado.
- Nit não bloqueante: `congelarApp`/`descongelarApp` não têm a guarda `if (!p) return` que `derrubarApp` tem
  (`base/scripts/ambiente.mjs:97-102` vs `107-108`); chamar com uma app nunca iniciada lançaria `TypeError`. Hoje não
  acontece porque a ordem dos testes garante a app viva. Sugestão de robustez, não achado.

### 3. Estabilidade de tempo do L7
- `TTL_SAUDE_PADRAO_MS = 1000` e `TIMEOUT_PROBE_PADRAO_MS = 500` (`repos/erp-shell/lib/saude-zonas.ts:6-7`,
  `cacheSaudePadrao = criarCacheSaudeZona()` usa os dois defaults — confirma que a correção de produção da V2 já
  existia; o que faltava era só o teste que a protegesse, que é exatamente o que este commit adiciona).
- L7 congela, espera 1200 ms (> TTL de 1000 ms, garante que a sonda vai reconsultar, não reusar um cache "saudável"
  anterior) e só então mede: sonda tem até 500 ms de timeout, o teste aceita até 2000 ms de status — margem de
  ~1500 ms para overhead de processo/scheduler, generosa para CI.
- Sem risco de tráfego concorrente mexendo no cache durante a janela: `navegador.test.mjs` e `saida-de-rede.test.mjs`
  (os outros arquivos do glob de `pnpm verificar`) não chamam `subir()` nem tocam a zona 2 — só `base.test.mjs` fala
  com o ambiente vivo, e dentro dele os testes rodam em sequência.
- L8 (nonce) fecha exatamente a lacuna que o auditor apontou (nonce fixo passava despercebido): os testes
  pré-existentes (`CSP com nonce…`, `G2`) só confirmavam presença de nonce numa resposta, nunca comparavam duas
  respostas. L8 faz duas requisições a `/` e a `/login` e exige nonces diferentes — determinístico, sem margem de
  tempo, não pode ser instável por natureza.

## Reprodução
- `node --check base/verificacao/base.test.mjs && node --check base/scripts/ambiente.mjs`: sintaxe OK.
- `node --test base/scripts/*.test.mjs`: 9/9 (arquivos puramente unitários, sem tocar portas; não têm teste
  dedicado a `congelarApp`/`descongelarApp`, mas não regrediram).
- `node --test base/verificacao/saida-de-rede.test.mjs`: 7/7 (confirma que N8 só varre `repos/erp-*`, não
  `base/scripts`, então a mudança em `ambiente.mjs` não precisa de exceção nova ali).
- Não rodei `base/verificacao/base.test.mjs`, `navegador.test.mjs` nem qualquer coisa que reserve
  3000–3003/4001–4004/4010, conforme instruído — o auditor é dono dessas portas agora.

## Conclusão
Os três pontos pedidos na revisão se sustentam: o teste de completude do L1 prova cobertura real (não decorativa),
o `congelarApp`/`descongelarApp` tem `try/finally` correto e sinaliza o grupo certo, e os tempos do L7 têm margem
suficiente para não ser instável. Nenhum achado bloqueante. Um nit de robustez (guarda ausente em
`congelarApp`/`descongelarApp`) registrado acima, não impede aprovação.
