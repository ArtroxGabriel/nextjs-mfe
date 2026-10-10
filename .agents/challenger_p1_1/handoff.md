# Challenger P1 — interrompido, parcial

Gate não aprovado: autenticação real do pnpm permanece sem confirmação. Parada solicitada pelo humano; nenhuma implementação alterada.

## Evidência realizada
- Node 24.21.0, npm 11.19.0, pnpm 12.5.1.
- Script /tmp/mira-challenger-test.mjs usa módulo real base/scripts/pacotes.mjs e subprocesso /tmp/mira-challenger-server.cjs, HTTP loopback porta efêmera.
- npm real pack e publish passaram duas vezes, portas 41913 e 33593. O servidor exige Bearer de fixture. Nenhuma publicação no Verdaccio ou registro externo.
- Confirmados metadata erpOrigem.commit, publishConfig.registry substituído pelo registro efêmero e integrity SHA512 correspondente ao tarball publicado. Republicação recusada antes de novo pack. Preflight verificar passou com lock fixture.
- pnpm view @erp/fixture version --config.@erp:registry=http://127.0.0.1:PORTA/ --config.npmrcAuthFile=ARQUIVO falhou com HTTP 401.
- Contraprova --config.npmrc-auth-file=ARQUIVO também falhou HTTP 401. Isto prova falha da sonda view, ainda NÃO prova falha de install.
- pnpm config get npmrcAuthFile e npmrc-auth-file com opção camel retornaram undefined.
- Fixture usa somente token fictício; nenhum segredo real utilizado ou escrito.

## Pendente para retomada
A versão atual de /tmp/mira-challenger-test.mjs foi preparada para comparar view com camel, kebab e --userconfig, e pnpm install --lockfile-only em fixture /tmp contendo somente @erp/fixture, registro default e scoped fixados no mock. A execução foi abortada antes de obter resultados. Retomar com node /tmp/mira-challenger-test.mjs fora do sandbox (sockets EPERM dentro). Registrar Authorization sem valor, confirmar diferença view/install e opções reconhecidas. O script imprime mensagem PASS de auth antes de avaliar matriz; corrigir essa mensagem antes de interpretar como aprovação.
Também pendentes: prova de redirect/no token ao alvo (script contém assert mas não chegou nele), export de evidência JSON, conferência YAML completa. Não declarar CI remoto nem registro compartilhado ativo.

## Cleanup
Execuções completas encerraram servidores pelo finally srv.kill(). A execução final foi abortada pelo usuário. Inspeção exclusivamente para cleanup fora do sandbox em /proc: nenhum processo cujo argv[1] seja /tmp/mira-challenger-test.mjs ou /tmp/mira-challenger-server.cjs encontrado (owned_processes_found 0). Logo não há servidor ou subprocesso próprio dessas sondas em execução; portas efêmeras 41913 e 33593 não têm servidor próprio restante. PIDs de servidores não foram registrados; pnpm filhos completos 276787 e 278673 já terminaram com exit 1. Nenhum recurso de sisbin, configuração global ou portas reservadas tocado.
