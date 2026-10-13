# ADR-0016: registro npm compartilhado e CI

**Status:** aceita para implementação pela autorização de prosseguir em 2026-10-09. **Data:** 2026-10-09.

## Contexto

O ADR-0010 exige que uma versão identifique um único artefato. Verdaccios por máquina e republicação local tornam os lockfiles incompatíveis. Os oito submódulos e o repositório principal estão no GitHub. Ainda não há endereço nem credencial de registro compartilhado neste projeto.

## Decisão

1. Usar GitHub Actions para as verificações do checkout principal com os commits exatos dos submódulos. GitLab continua sendo acompanhamento de atividades.
2. Manter `@erp/*` em um registro npm configurado por `ERP_NPM_REGISTRY`, HTTPS obrigatório fora de loopback. Não renomear todos os pacotes para o namespace de um serviço de hospedagem.
3. Instalar com lockfile congelado e conferir todos os hashes `@erp/*` antes de instalar. Hash divergente é erro, nunca motivo para recalcular o lockfile automaticamente.
4. Publicar somente versões ausentes. Erro de autenticação, redirecionamento e indisponibilidade não significam ausência. Preparar o tarball em diretório temporário, remover o destino local do manifesto de publicação e registrar o commit de origem. A política do registro deve impedir sobrescrita e exclusão: o preflight sozinho não resolve corrida entre publicadores.
5. Token de leitura é separado do token de publicação. Os comandos não recebem token nos argumentos. Arquivo de autenticação temporário usa modo 0600 e é removido no fim. Não alterar configuração global de npm, pnpm ou git.
6. CI de verificação não publica. Publicação é workflow manual no branch de integração, serializada. Nenhuma credencial de escrita é entregue à instalação ou aos testes.
7. O preparo local pode usar o registro de loopback, mas não republica versões existentes. Registro compartilhado precisa ser abastecido com os tarballs canônicos, incluindo dependências antigas, antes de usar instalação congelada. Não trocar hashes para mascarar migração de conteúdo.

## Consequências

Endereço, tokens e execução remota são requisitos de ativação e serão registrados separadamente. Este ADR não provisiona rede, balanceador, IdP ou store de sessão de produção. A permissão explícita para identidade dev pertence às ferramentas de showcase, e sai dos scripts de produção do shell.

## Adendo 1 : Package Registry do GitLab (2026-10-13)

**Status: aceito.** O humano escolheu em 2026-10-13 o Package Registry de uma instância
GitLab self-hosted como registro npm oficial. Endereço e credenciais ainda não existem;
este adendo aceita a escolha e o preparo, sem declarar ativação ou execução remota.

1. Manter `@erp/*` e publicar no endpoint de projeto
   `/api/v4/projects/<id>/packages/npm/`. Instalação pode usar projeto ou grupo; endpoint
   de instância só se o namespace raiz corresponder a `erp`. Não renomear os pacotes.
2. `ERP_NPM_REGISTRY` seleciona instalação e `ERP_NPM_REGISTRY_PUBLICACAO` seleciona
   publicação, com padrão igual ao de instalação. Preservar os caminhos completos na
   URL e na chave `_authToken`; credencial somente em arquivo temporário privado.
3. Selecionar versão na metadata do pacote (`versions`), sem GET por versão. JSON
   inválido, 401/403, 5xx e redirects não são ausência. GitLab recusa duplicado npm com
   403; o publicador também recusa 409. A recusa atômica deve ser provada na instância.
4. Preservar SHA-512 canônico. Se GitLab fornecer apenas SHA-1, calcular SHA-512 do
   tarball em um dos endereços explicitamente configurados, sem redirects. A migração
   fixa sua URL validada no lockfile, preservando o SHA-512, para o pnpm congelado não
   inferir um caminho convencional inexistente. GitLab
   filtra campos próprios; somente no GitLab a ausência de `erpOrigem` é aceitável,
   confirmando o commit pelos mesmos bytes do tarball. Nos demais registros o campo
   `erpOrigem.commit` continua obrigatório; origem presente divergente sempre é erro.
5. Desligar request forwarding no grupo/instância que hospeda os pacotes e exigir
   download de tarballs direto pelo GitLab (`proxy_download` para object storage),
   conforme o limite D34. Importar artefatos antigos sem reconstruir nem recomprimir.
6. Acrescentar CI GitLab equivalente, opt-in e desabilitado por padrão, mantendo os
   workflows GitHub. Publicação manual após verificação verde, serializada, somente em
   branch protegido. Credencial de escrita protegida e mascarada, limitada ao ambiente
   `publicacao-pacotes`; a verificação recebe só leitura. Submódulos ficam nos commits
   fixados, com `GIT_SUBMODULE_STRATEGY=recursive`. Antes da ativação humana, precisam
   de espelhos na mesma instância GitLab ou URLs relativas, com os commits preservados;
   este adendo não migra remotos nem cria credenciais.
7. A política de duplicados npm é nativa, sem toggle configurável de outros formatos.
   Política de exclusão e proteção precisa ser comprovada com a identidade escolhida;
   deploy tokens não publicam pacotes protegidos. P1 operacional continua pendente até
   endereço, credenciais, migração canônica, políticas verificadas e CI remoto verde.

O roteiro e as fontes oficiais estão em
[`REGISTRO-E-CI.md`, Ativação no GitLab](../REGISTRO-E-CI.md#ativação-no-gitlab).
Este adendo substitui a exclusividade do GitHub para CI e o papel apenas de acompanhamento
atribuído ao GitLab na decisão 1; os demais invariantes do ADR permanecem.
