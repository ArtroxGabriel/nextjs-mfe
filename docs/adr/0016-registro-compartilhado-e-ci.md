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
