# Registro de pacotes e CI

O fluxo do P1 está implementado para um registro npm compartilhado. A ativação ainda depende de endereço, tokens, tarballs canônicos e uma execução verde no CI remoto. O registro oficial escolhido é o Package Registry do GitLab self-hosted (ADR-0016, adendo aceito em 2026-10-13); a estrutura está preparada e a ativação continua pendente. O Verdaccio local continua sendo recurso de desenvolvimento, sem se tornar a fonte oficial por omissão no CI.

## Instalação

Configure `ERP_NPM_REGISTRY` para instalação e, se diferente, `ERP_NPM_REGISTRY_PUBLICACAO` para publicação (padrão: endereço de instalação), no ambiente do terminal ou do CI e `ERP_NPM_TOKEN` com uma credencial de leitura, quando necessária. O registro deve usar HTTPS fora de loopback. Endereço e token não entram no Git.

`task preparar` busca os submódulos fixados, ativa os hooks deste clone e chama `task instalar`. Não sobe contêineres nem publica pacotes. `task instalar` verifica primeiro todos os hashes `@erp/*` dos oito lockfiles e depois instala com `--frozen-lockfile`. Uma divergência interrompe a operação sem reescrever hash. Também são instaladas as dependências de desenvolvimento dos três pacotes.

A autenticação do pnpm usa `--userconfig` com arquivo temporário 0600. A remoção é síncrona no encerramento por SIGINT, SIGTERM e `exit`, além do `finally` em sucesso ou falha. Nos sinais, o comando encerra somente os grupos dos filhos que iniciou e aguarda sua saída; após `ERP_NPM_ENCERRAMENTO_MS`, usa SIGKILL nesses grupos. Os testes permanentes em `task scripts:test` exercitam pnpm/npm reais interrompidos nas duas operações e a saída explícita. SIGKILL no processo controlador ou queda da máquina não permitem executar cleanup.

A prova de autenticação instala um tarball real e recusa divergência de specifier sem reescrever o lockfile. No pnpm 12.5.1, a investigação mostrou que `npmrcAuthFile` camel/kebab não enviam Authorization; `--userconfig` funciona.

### Limite declarado: redirect de tarball

A consulta de metadata feita pelo preflight recusa 3xx, com zero chamadas ao destino. O download feito pelo pnpm 12.5.1 segue redirects. Não foi encontrada uma opção pública de recusa na [configuração de requisições](https://pnpm.io/settings/request); no [código dessa versão](https://github.com/pnpm/pnpm/blob/v12.5.1/pnpm/crates/network/src/requests.rs), o GET autenticado segue cada localização e recalcula a credencial para o destino. A recusa existe em APIs internas, sem configuração pública identificada para o instalador. Não se acrescenta proxy, downloader alternativo ou opção sem suporte.

Os testes reais permanentes provam somente o caso entre duas origens de loopback com portas diferentes: o destino recebe a chamada sem Authorization; bytes canônicos são aceitos e bytes adulterados são recusados por SHA-512 do lockfile congelado, sem reescrever o lock. Essa integridade protege os bytes, não restringe o destino de rede. A medição não certifica todas as cadeias, esquemas ou implantações externas. Para a ativação, o registro oficial deve servir os tarballs diretamente, sem redirect, e essa característica precisa ser verificada no serviço escolhido. A garantia de recusa de metadata não se estende ao downloader do pnpm.

Para desenvolvimento com o registro local já abastecido, use `task registry:subir` antes de `task preparar`. O padrão local é `http://localhost:4873/`. Não publique novamente uma versão existente para reparar uma máquina nova.

## Migração inicial

1. Defina um único armazenamento oficial e restrinja a publicação ao serviço de CI. O registro precisa impedir sobrescrita de versão e exclusão. Não reutilize a configuração anônima do Verdaccio de desenvolvimento para um serviço compartilhado.
2. Importe os tarballs canônicos existentes sem reconstruí-los nem recomprimi-los. O registro precisa servir os mesmos bytes com os mesmos hashes. Inclua contratos 0.2.1, que moldura e stub ainda consomem, além de contratos 0.4.0, núcleo 0.10.4 e moldura 0.5.0. Preserve o armazenamento original e registre a origem de cada artefato na migração.
3. Compare os lockfiles canônicos do Git, antes de usar qualquer ajuste local. Existem alterações locais de hash deliberadamente fora de commit em moldura e stub; isso não autoriza escolher seus valores como fonte oficial. Hashes diferentes para uma mesma versão precisam de reconciliação de conteúdo, como no ADR-0010.
4. Com o novo registro configurado e a metadata de integridade consistente, execute `task pacotes:migrar-registro`. A tarefa recusa hash divergente e não altera checksums. No GitLab, substitui URLs antigas (ou acrescenta a URL ausente) pela URL de tarball da metadata validada. O caminho do GitLab não segue a convenção npm: a instalação congelada precisa dessa URL explícita. Nos demais registros, mantém a retirada das URLs antigas. A instalação seguinte valida os bytes baixados pelo pnpm.
5. Execute `task instalar` numa máquina limpa, confira o diff e versione as mudanças de URL aprovadas nos submódulos. O caminho compartilhado não usa `task pacotes:alinhar-hashes`.

Se os bytes antigos não puderem ser preservados, publique versões novas e atualize consumidores de forma explícita. Nunca converta um artefato diferente para a versão antiga mudando seu checksum.

## Publicação

Publique um pacote de cada vez, na ordem contratos, núcleo e moldura quando todos mudarem. O pacote selecionado tem de ter versão nova e árvore limpa; suas dependências precisam estar publicadas. Mantenha os consumidores nas versões já publicadas até o artefato novo existir. Depois atualize os consumidores, com núcleo em lockstep nas quatro apps, e rode a regressão da integração.

O workflow manual `Publicar pacote imutavel` recebe o pacote por lista fechada. Só roda em `main` ou `bff-multizone`, depois do workflow de verificação. A concorrência de publicação deste repositório é serializada. O registro é responsável pela recusa atômica de publicação concorrente de uma mesma versão.

O comando local equivalente é `task pacotes:publicar -- erp-nucleo`, com `ERP_NPM_TOKEN_PUBLICACAO`. Sem argumento, seleciona os três pacotes. Uma versão existente, um 401, um 500 ou um redirecionamento na consulta de metadata interrompe a operação. Não há publicação automática em push.

O script exige árvore Git limpa e remove integralmente o `dist` ignorado antes de construir. Isso elimina saídas de fontes removidas, inclusive `.js` e `.d.ts` órfãos. Usa as dependências já instaladas no checkout; não refaz sua instalação em outro checkout. Constrói sem token no ambiente do build, prepara um tarball em diretório temporário e publica esse arquivo, sem scripts de ciclo de vida. O manifesto preparado contém `erpOrigem.commit` e `publishConfig.registry` com o registro validado. Depois confere nome, versão e SHA-512 do artefato confirmado pelo registro. Quando a metadata não fornece `dist.integrity`, calcula SHA-512 do tarball, com GET sem redirects e credencial restrita aos endereços configurados. O GitLab omite campos próprios como `erpOrigem` e pode servir somente SHA-1: o commit permanece no tarball preparado, cuja igualdade de SHA-512 confirma os bytes; a ausência de `erpOrigem` é aceitável somente para GitLab. Nos demais registros, `erpOrigem.commit` é obrigatório; em qualquer registro, um campo de origem presente deve coincidir. Uma falha nessa confirmação pode ocorrer depois de o registro aceitar o pacote: confira o estado antes de tentar publicar outra versão. Não há rollback nem exclusão automática.

## GitHub Actions

Configure no repositório principal:

| Nome | Tipo | Uso |
|---|---|---|
| `ERP_NPM_REGISTRY` | variável | endereço HTTPS do registro oficial |
| `ERP_NPM_REGISTRY_PUBLICACAO` | variável opcional | endpoint de projeto para publicação e tarballs se instalação usar grupo |
| `ERP_NPM_TOKEN_LEITURA` | secret | leitura durante a instalação; opcional se a leitura for pública |
| `ERP_NPM_TOKEN_PUBLICACAO` | secret | escrita, somente no passo de publicação |
| `SUBMODULOS_TOKEN` | secret | leitura dos repositórios privados dos submódulos, se necessária; sem ele usa `github.token` |

`Verificar a base` instala com lockfiles congelados e roda `task ci:verificar`: lockstep, commits de submódulos já enviados, unidades, estática e scripts. Depois executa `task verificar:construir` com sessão em arquivo. Redis, Keycloak e o showcase nos dois modos continuam nas tarefas próprias e no gate local. Os testes exclusivos de Redis podem ser pulados no modo arquivo, como já documentado no README.

Os workflows fixam Node 24.21.0, pnpm 12.5.1 e Task 3.53.1. Seus prazos são 30 minutos para verificação e 15 para publicação. Os runners são máquinas próprias do CI; nenhum serviço desta estação ou de outro projeto é usado. Pull requests de forks não recebem os secrets, então a instalação de pacotes privados precisa de uma execução no contexto autorizado do projeto. Não se usa `pull_request_target`.

Fontes para as opções usadas: [instalação congelada do pnpm](https://pnpm.io/cli/install), [autenticação do pnpm](https://pnpm.io/npmrc), [publicação do npm](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [workflows reutilizáveis](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations) e [setup do Task](https://github.com/go-task/setup-task).


## Observação da subida do shell

O challenger da iteração 2 observou `Ready` no log do Next antes da recusa de produção sem IdP. Nas sondas recusadas, o processo saiu com código 1 e não serviu resposta HTTP. O anúncio não prova disponibilidade. Esta correção do publicador não muda o shell.

## Ativação no GitLab

Esta seção prepara a ativação humana; nada foi provisionado. Conferência oficial em
2026-10-13, a repetir na versão da instância escolhida antes de habilitar o CI.

### Contrato npm confirmado

| Operação | Endpoint (exemplo fictício) |
|---|---|
| Publicar e instalar por projeto | `https://gitlab.exemplo/api/v4/projects/123/packages/npm/` |
| Instalar por grupo | `https://gitlab.exemplo/api/v4/groups/456/-/packages/npm/` |
| Instalar por instância | `https://gitlab.exemplo/api/v4/packages/npm/` |

Só o endpoint de **projeto publica**. Projeto e grupo permitem manter `@erp/*` sem exigir
namespace raiz `erp`; para instalar pela instância, `@erp` deve corresponder ao namespace
raiz do projeto que hospeda os pacotes, em minúsculas. Preferir o projeto único para evitar
essa restrição e colisões entre projetos. Fontes: [npm registry](https://docs.gitlab.com/user/packages/npm_registry/#naming-convention)
e [matriz de funcionalidades](https://docs.gitlab.com/user/packages/package_registry/supported_functionality/).

A [API npm](https://docs.gitlab.com/api/packages/npm/) documenta GET `/<nome>` com
`versions`, PUT `/<nome>` no projeto e GET do tarball indicado pela metadata; não documenta
GET `/<nome>/<versão>`. O script seleciona a chave da versão: 404 do pacote ou chave ausente
em metadata válida significam ausência; JSON inválido, 401, 403, 5xx e 3xx interrompem.

A matriz oficial marca duplicados npm como **não permitidos**, sem toggle “duplicates”
configurável para npm. Não usar a opção de Generic/Maven/NuGet para certificar npm. O
[código oficial do endpoint](https://gitlab.com/gitlab-org/gitlab/-/blob/master/lib/api/npm_project_packages.rb)
mapeia `package_already_exists` para **403**, não 409. O cliente recusa ambos, inclusive em
corrida após o preflight. A
[listagem de configurações](https://docs.gitlab.com/development/packages/settings/) não
contém `npm_duplicates_allowed`. A garantia real deve ser demonstrada na instância; um
403 também pode ser falta de permissão e nunca é sucesso idempotente.

GitLab pode encaminhar ausentes por redirect ao npmjs. Desligar forwarding para o grupo
que hospeda `@erp` (a configuração é por grupo/instância, não uma regra npm por texto de
escopo). Isso evita buscar um `@erp/*` público quando um privado estiver ausente. O
preflight recusa o redirect, mas não substitui essa política no downloader. Fonte:
[forwarding e dependency confusion](https://docs.gitlab.com/user/packages/package_registry/supported_functionality/#forwarding-requests).

Tarballs em object storage podem gerar 302 para URL assinada. O administrador deve usar
`proxy_download=true` para packages (ou armazenamento local servido diretamente); na
forma consolidada, a opção específica é
`gitlab_rails['object_store']['objects']['packages']['proxy_download'] = true`.
Conferir overrides por objeto e eventuais modos de download da versão instalada. Isso é
pré-condição do D34: SHA-512 garante bytes, não o destino seguido pelo pnpm. Fonte:
[object storage / Proxy Download](https://docs.gitlab.com/administration/object_storage/#proxy-download).

Todos os tokens npm documentados usam `_authToken`: `CI_JOB_TOKEN`, deploy token com
`read_package_registry`/`write_package_registry`, ou token pessoal com `api`. A chave deve
preservar host, porta não padrão e caminho completo, por exemplo
`//gitlab.exemplo/api/v4/projects/123/packages/npm/:_authToken=…`, apenas em arquivo
privado temporário, nunca no Git. Fonte:
[autenticação npm](https://docs.gitlab.com/user/packages/npm_registry/#authenticate-to-the-package-registry).

O [gerador oficial de metadata](https://gitlab.com/gitlab-org/gitlab/-/blob/master/app/services/packages/npm/generate_metadata_service.rb)
filtra campos próprios e gera `dist` com SHA-1 e URL de tarball. Por isso o preflight e a
confirmação calculam SHA-512 dos bytes quando faltar `dist.integrity`. Esses GETs só usam
os prefixos de instalação/publicação explicitamente configurados, com `redirect: manual`;
nenhuma URL vinda da metadata amplia a credencial. Em instalação por grupo, configure
também o projeto em `ERP_NPM_REGISTRY_PUBLICACAO`: a auth temporária de leitura inclui
somente o caminho de instalação. A publicação associa seu token somente ao projeto.
A URL de tarball de projeto continua validada no preflight; a autenticação do downloader
com esse escopo restrito precisa ser provada na instância antes de escolher instalação por grupo. A migração fixa essa URL
no lockfile, com SHA-512 intacto: o pnpm 12.5.1 congelado não descobre o caminho próprio
do GitLab a partir de um lock que contenha só integrity. A prova real anterior usou grupo para
metadata e projeto para tarball, com duas chaves de auth. Após restringir a auth a uma
chave por operação, essa prova precisa ser repetida; o mock recusa o caminho convencional. Ver
[lockfileIncludeTarballUrl](https://pnpm.io/settings/store#lockfileincludetarballurl)
para preservar URLs ao gerar locks futuros.

### Passos para o humano

1. Criar projeto privado dedicado ao registro na instância self-hosted, com Package
   Registry habilitado. Anotar versão do GitLab, ID do projeto, HTTPS e responsável pelos
   artefatos; não preencher endereço ou token no código. Instalação e publicação podem
   começar pelo mesmo endpoint de projeto; grupo é opcional.
2. Como Owner, em **Settings > Packages and registries > Package forwarding** do grupo,
   desmarcar **Forward npm package requests**; se a opção não existir na edição/versão,
   pedir ao administrador a recusa na instância em **Admin > Settings > CI/CD**. Confirmar
   que GET de um nome fictício ausente devolve 404, sem Location para npmjs.
3. Proibir duplicados e exclusão por política operacional e permissões do registro.
   npm tem recusa nativa de duplicados, não toggle: com pacote descartável, comprovar que
   repetir a mesma versão dá erro e mantém o SHA-512 original. Testar também concorrência
   e negar exclusão à identidade de publicação. Restringir membros e não habilitar limpeza
   dos artefatos canônicos. As
   [regras de proteção](https://docs.gitlab.com/user/packages/package_registry/package_protection_rules/)
   dependem da versão; **deploy token não publica pacote que case uma regra de proteção**.
   Se proteger `@erp/*`, escolher identidade compatível e provar as permissões; não declarar
   imutabilidade absoluta contra administradores, que podem mudar regras ou apagar dados.
4. Criar deploy token de leitura (`read_package_registry`) separado da credencial de escrita.
   Para pacotes sem regra de proteção, deploy token de publicação precisa de leitura e
   escrita para as consultas e o PUT. Se usar token pessoal/de projeto, usar `api` com a
   identidade e papel mínimos compatíveis, expiração e rotação. Não chamar o deploy token
   de escrita de `gitlab-deploy-token`, que pode expor variáveis automáticas a todos os jobs.
   Fontes: [deploy tokens](https://docs.gitlab.com/user/project/deploy_tokens/)
   e [proteção de pacotes](https://docs.gitlab.com/user/packages/package_registry/package_protection_rules/).
5. No projeto do CI, proteger `main`/`bff-multizone` e configurar:

   | Variável | Escopo e uso |
   |---|---|
   | `ERP_NPM_REGISTRY` | endereço HTTPS de instalação; sem segredo |
   | `ERP_NPM_REGISTRY_PUBLICACAO` | endpoint de projeto, se diferente; sem segredo |
   | `ERP_NPM_TOKEN_LEITURA` | mascarada; só `read_package_registry` |
   | `ERP_NPM_TOKEN_PUBLICACAO` | **variável de projeto protegida, mascarada, environment scope `publicacao-pacotes`**, nunca `*` |
   | `PACOTE` | seleção do pipeline manual, um dos três pacotes publicáveis |
   | `ERP_GITLAB_CI_ATIVAR` | manter ausente até terminar os passos anteriores; depois `1` |

   O arquivo preparado usa credencial protegida por ambiente, sem fallback automático para
   `CI_JOB_TOKEN`. Este é suportado pelo npm, mas o GitLab o cria em todos os jobs; não
   equivale a escrita isolada por job. Manter o projeto do registro separado do CI e não
   autorizar seus job tokens para escrita no registro. Se optar por ele no futuro, validar allowlist e
   permissões entre projetos sem conceder publicação aos jobs de verificação. Fonte:
   [CI job token](https://docs.gitlab.com/ci/jobs/ci_job_token/). O isolamento de segredo por
   ambiente é documentado em [CI/CD variables](https://docs.gitlab.com/ci/variables/).
6. Importar os tarballs canônicos da migração inicial **sem trocar bytes**. Não usar
   `task pacotes:publicar`, build ou repack para versões antigas. Usar a
   [API npm PUT](https://docs.gitlab.com/api/packages/npm/#upload-a-package-file): metadata
   da versão com SHA-1/SHA-512 calculados do arquivo original e `_attachments` com seu
   base64 original. Isso preserva até `publishConfig` antigo dentro do arquivo sem
   encaminhar a importação ao registro antigo. Registrar commit/origem/hashes fora do
   tarball sem alterar seu conteúdo. O importador npm oficial é alternativa se a prova
   de SHA-512 confirmar preservação. Reconciliar divergências locais conforme ADR-0010;
   manter backup da fonte canônica, incluindo as versões transitivas.
7. Como administrador, configurar proxy de download se usar object storage. Baixar cada
   tarball canônico por GET **sem `-L`/redirects**, autenticado por arquivo temporário 0600,
   conferir HTTP 200, ausência de Location, SHA-512 e origem/caminho. Não gravar URL assinada
   em log ou lockfile. Se houver redirect, interromper a ativação e corrigir o serviço.
8. Com leitura configurada, executar primeiro `task pacotes:migrar-registro`, que prova
   os hashes antes de escrever as URLs da metadata do GitLab. Depois
   `task pacotes:verificar`, conferir que só URLs foram substituídas/acrescentadas e hashes
   ficaram iguais. Depois `task instalar` em clone limpo e a regressão. Versionar apenas
   as mudanças de URL aprovadas; não alinhar hashes automaticamente.
9. Preparar runner Linux descartável com acesso aos remotos reais dos submódulos. O CI
   fixa `GIT_SUBMODULE_STRATEGY=recursive` e profundidade 0, sem trocar gitlinks. Os remotos
   atuais estão no GitHub: os submódulos precisam estar espelhados na mesma instância
   GitLab, com seus commits preservados, usando URLs dessa instância ou URLs relativas.
   Ajustar `.gitmodules` apenas na ativação humana, após revisar os espelhos. Sem esses
   espelhos, o CI GitLab preparado não está pronto para checkout autenticado. Não inventar
   credencial para GitHub; `GIT_SUBMODULE_FORCE_HTTPS` e `CI_JOB_TOKEN` só resolvem esse
   fluxo na mesma instância GitLab. Configurar a allowlist de leitura dos espelhos. Fonte: [submódulos no Runner](https://docs.gitlab.com/ci/runners/git_submodules/).
10. Validar `.gitlab-ci.yml` no CI Lint da instância, definir `ERP_GITLAB_CI_ATIVAR=1` e rodar
    pipeline de verificação: instalação congelada, `task ci:verificar` e
    `task verificar:construir`. Só depois, num pipeline iniciado pela interface (**web**) em
    branch protegido, informar `PACOTE` e acionar o job manual `publicar`. `needs` exige
    verificação verde e `resource_group` serializa a publicação. O token é retirado do
    ambiente da instalação/build/pack; os testes não recebem escrita. Documentar URL e
    resultado do pipeline antes de fechar P1 operacional. Fonte:
    [sintaxe do GitLab CI](https://docs.gitlab.com/ci/yaml/).

Os workflows GitHub permanecem disponíveis e recebem também o endpoint opcional de
publicação. Node 24.21.0, pnpm 12.5.1, Task 3.53.1 e prazos 30/15 minutos são os mesmos.
A instalação das ferramentas na imagem descartável segue a
[opção npm oficial do Task](https://taskfile.dev/docs/installation#npm).
