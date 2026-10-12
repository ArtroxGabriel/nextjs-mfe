# Registro de pacotes e CI

O fluxo do P1 está implementado para um registro npm compartilhado. A ativação ainda depende de endereço, tokens, tarballs canônicos e uma execução verde no GitHub Actions. O Verdaccio local continua sendo recurso de desenvolvimento, sem se tornar a fonte oficial por omissão no CI.

## Instalação

Configure `ERP_NPM_REGISTRY` no ambiente do terminal ou do CI e `ERP_NPM_TOKEN` com uma credencial de leitura, quando necessária. O registro deve usar HTTPS fora de loopback. Endereço e token não entram no Git.

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
4. Com o novo registro configurado e a metadata de integridade consistente, execute `task pacotes:migrar-registro`. A tarefa recusa hash divergente e remove somente URLs de tarball fixadas no registro antigo; não altera checksums. A instalação seguinte valida os bytes baixados pelo pnpm.
5. Execute `task instalar` numa máquina limpa, confira o diff e versione a remoção das URLs antigas nos submódulos. O caminho compartilhado não usa `task pacotes:alinhar-hashes`.

Se os bytes antigos não puderem ser preservados, publique versões novas e atualize consumidores de forma explícita. Nunca converta um artefato diferente para a versão antiga mudando seu checksum.

## Publicação

Publique um pacote de cada vez, na ordem contratos, núcleo e moldura quando todos mudarem. O pacote selecionado tem de ter versão nova e árvore limpa; suas dependências precisam estar publicadas. Mantenha os consumidores nas versões já publicadas até o artefato novo existir. Depois atualize os consumidores, com núcleo em lockstep nas quatro apps, e rode a regressão da integração.

O workflow manual `Publicar pacote imutavel` recebe o pacote por lista fechada. Só roda em `main` ou `bff-multizone`, depois do workflow de verificação. A concorrência de publicação deste repositório é serializada. O registro é responsável pela recusa atômica de publicação concorrente de uma mesma versão.

O comando local equivalente é `task pacotes:publicar -- erp-nucleo`, com `ERP_NPM_TOKEN_PUBLICACAO`. Sem argumento, seleciona os três pacotes. Uma versão existente, um 401, um 500 ou um redirecionamento na consulta de metadata interrompe a operação. Não há publicação automática em push.

O script exige árvore Git limpa e remove integralmente o `dist` ignorado antes de construir. Isso elimina saídas de fontes removidas, inclusive `.js` e `.d.ts` órfãos. Usa as dependências já instaladas no checkout; não refaz sua instalação em outro checkout. Constrói sem token no ambiente do build, prepara um tarball em diretório temporário e publica esse arquivo, sem scripts de ciclo de vida. O manifesto preparado contém `erpOrigem.commit` e `publishConfig.registry` com o registro validado. Depois confere a integridade e o commit na metadata devolvida. Uma falha nessa confirmação pode ocorrer depois de o registro aceitar o pacote: confira o estado antes de tentar publicar outra versão. Não há rollback nem exclusão automática.

## GitHub Actions

Configure no repositório principal:

| Nome | Tipo | Uso |
|---|---|---|
| `ERP_NPM_REGISTRY` | variável | endereço HTTPS do registro oficial |
| `ERP_NPM_TOKEN_LEITURA` | secret | leitura durante a instalação; opcional se a leitura for pública |
| `ERP_NPM_TOKEN_PUBLICACAO` | secret | escrita, somente no passo de publicação |
| `SUBMODULOS_TOKEN` | secret | leitura dos repositórios privados dos submódulos, se necessária; sem ele usa `github.token` |

`Verificar a base` instala com lockfiles congelados e roda `task ci:verificar`: lockstep, commits de submódulos já enviados, unidades, estática e scripts. Depois executa `task verificar:construir` com sessão em arquivo. Redis, Keycloak e o showcase nos dois modos continuam nas tarefas próprias e no gate local. Os testes exclusivos de Redis podem ser pulados no modo arquivo, como já documentado no README.

Os workflows fixam Node 24.21.0, pnpm 12.5.1 e Task 3.53.1. Seus prazos são 30 minutos para verificação e 15 para publicação. Os runners são máquinas próprias do CI; nenhum serviço desta estação ou de outro projeto é usado. Pull requests de forks não recebem os secrets, então a instalação de pacotes privados precisa de uma execução no contexto autorizado do projeto. Não se usa `pull_request_target`.

Fontes para as opções usadas: [instalação congelada do pnpm](https://pnpm.io/cli/install), [autenticação do pnpm](https://pnpm.io/npmrc), [publicação do npm](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [workflows reutilizáveis](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations) e [setup do Task](https://github.com/go-task/setup-task).


## Observação da subida do shell

O challenger da iteração 2 observou `Ready` no log do Next antes da recusa de produção sem IdP. Nas sondas recusadas, o processo saiu com código 1 e não serviu resposta HTTP. O anúncio não prova disponibilidade. Esta correção do publicador não muda o shell.
