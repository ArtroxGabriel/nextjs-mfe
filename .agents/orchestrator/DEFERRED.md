# Adiados de propósito

> Só o que está **aberto**. Cada item diz o que é, a evidência e em que atividade do plano fecha.
> Os itens da PoC (D1–D11) fecharam por substituição em 2026-09-21; estão na tag `historico-2026-09-22`.
> D13 (ator só com `tarefas.ver`) e D15 (lacunas sem veto da iteração 9) fecharam na K6 (2026-09-29, `d1d6345`;
> saíram daqui em `51fd1ab`); conferido de novo na Task 6 do D2 (2026-10-03). D16 (verificação OIDC contra o Keycloak)
> abriu e fechou na mesma task: adendo 2 do ADR-0013 e `task verificar:oidc`.

## D7 — Zona travada segura a requisição até o `proxyTimeout` do Next

- **Evidência:** zona congelada com `SIGSTOP` logo após uma sonda saudável: a requisição dentro da janela
  de 1 s esperou ~30 s e recebeu 500 cru (3/3); na PoC e de novo no `challenger_shell_1` (~0,6 s com a sonda nova).
- **Por que não foi corrigido:** a alavanca é `experimental.proxyTimeout`, que vale para toda resposta
  repassada, inclusive SSE. Escolher o valor é decisão operacional.
- **Fecha em:** C2 (SSE no shell), junto com o tempo de vida de respostas longas; registrar o valor em
  `docs/desenho/mfe/01-operacao.md` §5.1.

## D12 — Menores do núcleo (fatia 1)

| Item | Estado | Fecha em |
|---|---|---|
| `sessaoArquivo`: diretório sem permissão restritiva (`sessao-arquivo.ts:18`) | aberto | D1 (Redis substitui o arquivo) |
| `sessaoArquivo.ler`: `existsSync` antes de `readFileSync` (TOCTOU inofensivo) | aberto | D1 |
| `sanitizarSupportId` valida formato, não semântica | aceito | F4 (padronização de erro) |
| teste de namespace passa com `caminhos` vazio | a conferir | F6 (camada de testes) |

## D14 — Limites declarados dos analisadores estáticos (Decisão A2, 2026-09-23)

- **O que é:** os analisadores de `base/verificacao/` (`seguranca-estatica.mjs`, `saida-de-rede.mjs`) e a fronteira do núcleo
  pegam o **erro de boa-fé**; um contorno escrito de propósito sempre acha outra sintaxe. Pela Decisão A2, contorno deliberado
  não veta o gate: fica aqui, com a defesa que vale contra ele. Erro plausível de boa-fé continua vetando.
- **Classes aceitas** (IDs do `auditor_b1_d1_4/mutacoes.txt`, no git em `ec08ed1`; a iteração 6 confere o que a K3/K4 já fechou):

| Classe | Exemplos | Defesa que vale |
|---|---|---|
| ilha alcançada por indireção (apelido condicional, objeto de componentes, barril sem `from`) | XA09–XA13 | domínio devolve só o que o usuário pode ver (inv. 9); ponta a ponta procura dado interno no HTML e no RSC |
| chave calculada ou sintaxe montada (`['e'+'nv']`, `'const'+'ructor'`, `process['bind'+'ing']`) | XN02–XN04, XR28, XR31 | a zona não tem credencial nem endereço de domínio que valha fora do registro de destinos |
| `acaoProtegida` falsa ou domínio chamado por helper no argumento | XP01, XP03–XP06 | ponta a ponta de `Origin` e `CAMPOS_VALIDOS` (P09b); o domínio recusa sem credencial |
| navegação entre zonas escrita de forma indireta | XL01–XL04 | só experiência de uso: a zona de destino exige sessão e `exigirModulo` |
| rota do domínio repassada por `rewrites`/`NextResponse.rewrite` | XN08, XR30 | o domínio responde 401 sem credencial; bloqueio de saída de rede no deploy |
| `require` por apelido e `__non_webpack_require__` (auditor_b1_d1_9) | XR40–XR44 | mesma de chave calculada: a zona não tem credencial nem endereço de domínio fora do registro |
| rede do navegador sem `fetch` (`WebTransport`, `Image`, `Worker`) (auditor_b1_d1_9) | XR45–XR48 | CSP `default-src 'self'` em shell e zonas (teste de CSP do ponta a ponta) |

- **Barreira de ambiente em vigor desde a K5:** zona e domínio recebem o ambiente por lista de inclusão, em toda fase
  (`base/scripts/ambiente.mjs`); a senha de escrita não chega a eles, conferido em `/proc/<pid>/environ` por
  `base/verificacao/base.test.mjs` com `ERP_REDIS_SENHA_SHELL` sempre definida.
- **Fecha em:** bloqueio de saída de rede das zonas no deploy (P1, fim do plano). Até lá, risco aceito.

## D17 — Zonas leem `refreshToken` e `idToken` (ADR-0013, decisão 2, não cumprida)

- **O que é:** a decisão 2 diz que o leitor das zonas descarta `refreshToken` e `idToken`. O leitor (`sessaoRedis`,
  `sessaoArquivo`) devolve a `SessaoArmazenada` inteira, e o usuário ACL das zonas no Redis tem `GET` em
  `erp:sessao:*`, que traz o JSON com os dois. Nada chega ao navegador (`nucleo.sessao.atual` projeta `{ sub, nome }`,
  invariante 1), mas uma zona comprometida teria o refresh token de toda sessão que lê.
- **Evidência:** `erp-nucleo/src/adaptadores/sessao-redis.ts` e `sessao-arquivo.ts` sem descarte; registrado na
  Task 2 do D2 (`RETOMADA.md`, "Para a Task 4") e não feito na Task 4.
- **Por que não foi corrigido:** descartar no leitor obriga o shell a ter leitura completa própria (a renovação relê o
  refresh token); separar o que a zona alcança no Redis exige outra chave ou outro formato. Decisão de desenho.
- **Fecha em:** revisão final do D2 decide se entra antes do gate ou vira fatia própria.

## D18 — `/login/dev` aberto quando o shell sobe em produção sem `IDP_EMISSOR`

- **O que é:** os scripts `build` e `start` do `erp-shell` fixam `ERP_PERMITIR_IDENTIDADE_DEV=1`. Sem `IDP_EMISSOR`,
  um deploy que use `pnpm start` sobe com `identidadeDev`: qualquer um entra como qualquer ator, sem senha.
- **Evidência:** `erp-shell/package.json` (`"start": "ERP_PERMITIR_IDENTIDADE_DEV=1 next start -p 3000"`); a guarda
  em `erp-nucleo/src/adaptadores/identidade-dev.ts` só vale sem a variável. Achado menor da revisão da Task 4 do D2,
  anterior ao D2.
- **Por que não foi corrigido:** fora do escopo do D2; a verificação e o showcase dependem desse script.
- **Fecha em:** P1 (deploy, fim do plano): script de produção sem a variável, ou recusa explícita sem `IDP_EMISSOR`.
