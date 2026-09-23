# Ambiente e armadilhas — o que já custou tempo e como evitar

> Regras práticas aprendidas no trabalho. Leia antes de instalar, publicar, commitar ou enviar.
> Cada item diz **o que fazer**, **por quê** e onde está a evidência.

## 1. Pacotes, Verdaccio e lockfiles

- **Cada máquina tem o próprio Verdaccio** (`localhost:4873`, `base/.verdaccio/`). O que um publica
  não existe no do outro.
- **Nunca publique o mesmo número de versão duas vezes**, nem em máquinas diferentes. `npm pack` não
  é reproduzível byte a byte: o mesmo commit republicado gera outro hash, e o `pnpm install` recusa o
  lockfile com `ERR_PNPM_TARBALL_INTEGRITY`. Mudou o pacote → versão nova.
  *Evidência:* ADR-0010; em 2026-09-21 `@erp/nucleo` 0.3.1, `@erp/contratos` 0.2.1 e
  `@erp/moldura` 0.3.0 tinham hashes diferentes em cada máquina.
- **Se um lockfile vindo de outra máquina falhar por integridade:**
  1. confira se o **commit de origem** do pacote é o mesmo (`git ls-tree HEAD repos/erp-<pacote>`);
  2. se for, troque só a linha `integrity` pelo hash do seu Verdaccio (o do lockfile anterior serve);
  3. se não for, é conteúdo diferente: pare e decida qual vale (foi o caso do núcleo, ADR-0010).
  Nunca use `--update-checksums` às cegas: ele aceita qualquer conteúdo.
  O passo 2 é a tarefa **`task pacotes:alinhar-hashes`** (troca todos os `@erp/*` de uma vez).
- **Lockfile com hash desta máquina não entra em commit.** Em 2026-09-22 os dois lados commitaram
  "update local registry package integrity hash" em sequência e cada commit quebrava a instalação do
  outro. Adicione arquivo por arquivo e deixe o `pnpm-lock.yaml` fora, salvo quando a mudança for de
  dependência de verdade (aí avise no commit que o hash é desta máquina). A saída definitiva é um
  registro único (#14).
- **Quem tem no Verdaccio local um `@erp/nucleo` 0.3.1 publicado antes de 2026-09-21** (a reescrita
  paralela) não deve usá-lo: publique o `erp-nucleo` atual (`pnpm publicar`) e reinstale as apps.
  O 0.3.1 válido é o da árvore reconciliada no ADR-0010; as apps hoje fixam 0.3.2.
- Ordem de publicação: `erp-contratos` → `erp-nucleo` → `erp-moldura` → consumidores.
- O pnpm acrescenta sozinho a versão nova em `minimumReleaseAgeExclude` (`pnpm-workspace.yaml` de cada
  app). É esperado: pacote local recém-publicado não tem "idade".
- **Instalar pacote exige aprovação do humano** (CLAUDE.md dele). Mostre o que muda antes.

## 2. Submódulos e envio

- Os 8 `repos/erp-*` são submódulos. **Envie o submódulo antes do principal.** Se o principal apontar
  para um commit que só existe na sua máquina, quem clona não consegue buscá-lo e acaba refazendo o
  trabalho. Foi a causa do ADR-0010.
- **O hook `pre-push` checa isso sozinho** (`base/scripts/checar-envio.mjs`): recusa o push do
  principal se algum commit fixado de submódulo não está em nenhum branch remoto. Ative uma vez
  por clone: `git config core.hooksPath .githooks`. À mão: `pnpm checar-envio`.
- **O mesmo hook checa o lockstep do núcleo** (`base/scripts/verificar-lockstep.mjs`): as quatro
  apps têm de usar a mesma versão exata do `@erp/nucleo`, e o lockfile tem de concordar. Ao subir o
  núcleo, suba nas quatro juntas. À mão: `pnpm lockstep`.
- **Não use `git commit -a` no principal** quando um submódulo tem commit ainda não verificado:
  o `-a` inclui o ponteiro do submódulo. O hook barra o push (aconteceu em 2026-09-21), mas o
  certo é adicionar arquivo por arquivo.
- HEAD destacado num submódulo esconde commits: trabalhe no `master` (`git checkout master`) antes de
  commitar lá.
- `git merge -s ours X` **mantém a árvore do branch atual**. Para ficar com o seu conteúdo e absorver
  o histórico de outro, faça checkout do **seu** commit e rode `merge -s ours <o outro>`. Na ordem
  inversa você fica com o conteúdo do outro.
- O principal vai direto para `origin/bff-multizone` (fast-forward). `main` só por PR.

## 3. Testes e servidores

- **Use o Taskfile** (`task`, na raiz): é o padrão desde 2026-09-22. `task test`, `task verificar`,
  `task verificar:construir`, `task showcase:*`. Os comandos abaixo são o que as tarefas chamam.

- `node --test` precisa de **glob explícito** (`node --test test/*.test.mjs`). No Node 24.7,
  `node --test <pasta>` roda zero testes e sai com 0.
- Núcleo: `node --conditions react-server --test test/*.test.mjs`, depois de `tsc -p tsconfig.json`.
- Ponta a ponta: `pnpm verificar` (usa os builds existentes) ou `pnpm verificar:construir` (refaz).
  Esperado hoje (2026-09-23): Redis 100/100; arquivo 96 + 4 pulados (os 4 só valem com Redis).
- **Teste que só roda num modo esconde defeito.** A K3 passou por revisor e challenger sem nunca ter rodado com
  `task verificar:redis`, e o teste novo dela quebrava o modo arquivo. Fatia que toca sessão, Redis ou ambiente roda
  **os dois modos** antes do commit.
- **O Redis do showcase exige senha para escrita desde a K4-4** (`ERP_REDIS_SENHA_SHELL`). Um container criado antes
  aceita escrita anônima e o teste `so o endereco do Redis nao grava sessao` reprova: `task showcase:descer` e
  `task showcase:subir` para recriar (o volume fica).
- Um teste estático que dá para contornar (`globalThis['fetch']` no lugar de `fetch(`) foi contornado. Checagem por regex tem de cobrir as formas indiretas, e todo contorno achado vira caso do teste.
- **Mutação em código que grava arquivo pode sujar dados versionados.** Em 2026-09-22 a mutação
  "sem pasta, grave na semente" do `erp-dominio-stub` gravou em `dados/semente/*.json`; restaurar o
  `.mjs` não restaurou a semente e a mutação seguinte pareceu pegar por outro motivo. Antes de mutar,
  tire cópia dos dados e restaure-a depois de cada mutação (ou rode a mutação numa cópia).
- **Um dono por vez para as portas** 3000–3003, 4001–4004 e 4010. Num gate, só o challenger sobe
  servidores; o auditor espera. O Verdaccio (4873) ninguém derruba.
- Não existe `tsx` nem `rtk` nesta máquina; não buscar.

- **Não edite por número de linha (`sed -i 'Ns…'`) depois de outra edição no mesmo arquivo.** Em
  2026-09-22 o número vinha de um `grep` anterior à edição e o `sed` apagou a asserção do L3; a
  verificação deu 50/50 com um teste vazio. Edite por conteúdo (texto único) e confira o `git diff`.

## 4. Commits

- **Sem rodapé de coautoria** (`Co-Authored-By`, `Claude-Session`, "Generated with"): o hook
  `no-ai-authorship` bloqueia o commit. A mensagem termina no conteúdo.
- Mensagem em inglês, no estilo `tipo(escopo): resumo` já usado no histórico.

## 5. Agentes e custo

- Opus para julgamento (auditor forense com veto, decisão de gate); Sonnet para trabalho mecânico
  ou com checklist (revisor, challenger, re-rodar scripts). Escolha o `model` em todo despacho.
- Nunca reusar um verificador que já entregou handoff: gate novo, agente novo.
- Pesquisa aberta ou busca na web: escrever em `pedidos/AAAA-MM-DD-<assunto>.md` e esperar o humano.
- **Limite de uso interrompe agente no meio de uma mutação.** Em 2026-09-22 o auditor parou duas vezes (uma por engano do
  orquestrador, outra pelo limite da API) com mutação aplicada no `dist` instalado e um `tee` pendurado. Ao retomar: conferir
  fontes (`git status` dos submódulos), `dist` contra o tarball do Verdaccio (hash da árvore), portas e processos (`ps`), e
  retomar o MESMO agente com SendMessage dizendo o que achou. Nunca parar um verificador por conta própria.
- **Mutação que só o comportamento revela exige o challenger certo.** Na iteração 3, P09 (action chamando o domínio antes da
  checagem) e E10c (CPF numa prop de ilha) passaram 71/71 e só o auditor viu. No despacho do challenger, listar as mutações
  sobreviventes da rodada anterior como casos a exercitar com a base no ar.
- O auto mode pode bloquear `pnpm install`, `git` em submódulos e `push`. Quando bloquear, salve o
  estado em `RETOMADA.md`, explique o que falta e peça a liberação.
