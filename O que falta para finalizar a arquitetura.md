O que falta para finalizar a arquitetura

1. O que a arquitetura prometia

O objetivo é um ERP dividido em micro front-ends (MFE): cada módulo (Pedidos, Estoque, Comercial) é uma aplicação separada, feita e publicada pelo próprio time. Para o usuário, tudo continua parecendo um único sistema, num único endereço.

As peças do desenho:

- Multi-Zones. Cada módulo é uma zona, ou seja, uma aplicação Next.js própria que atende um prefixo de endereço (/pedidos/*, /estoque/*). Uma aplicação central, o shell, recebe todas as requisições e as repassa à zona certa por rewrite (reencaminhar a requisição sem mudar o endereço que o usuário vê).
- Por que Multi-Zones e não Module Federation. No Module Federation, que era a abordagem anterior, o código de outro módulo é baixado e montado no navegador. Isso quer dizer que ele chega ao usuário antes de alguém verificar se aquele usuário pode vê-lo. No Multi-Zones, a página é montada no servidor, e a permissão é checada antes de qualquer dado sair. Essa foi a razão central da escolha.
- BFF (Backend for Frontend). Cada zona tem uma camada de servidor própria, que conversa com o sistema de negócio (o domínio) dela e entrega à tela só o que ela precisa. Regra: uma zona fala com um único domínio.
- Fragmento. Quando uma zona precisa mostrar algo de outro módulo, ela pede um "pedaço" pronto à zona dona desse dado, e é essa zona que aplica as próprias regras de acesso. O pedido tem timeout (tempo máximo de espera) e circuit breaker (depois de falhas repetidas, para de chamar a zona com defeito por um tempo), para que uma zona lenta não derrube a outra.
- Sessão única. O login é feito por um provedor de identidade externo (OIDC). O navegador guarda só um identificador opaco num cookie, e todas as zonas leem os dados da sessão num armazenamento compartilhado (Redis).
- Falha isolada. Se uma zona cair, o resto do sistema continua funcionando e mostra uma página de erro só para aquela parte.
- Pacotes comuns. O @erp/nucleo concentra as regras que toda zona segue: sessão, erros e acesso a dados. O @erp/contratos define os formatos de dados trocados entre as partes. O @erp/ui reúne os componentes visuais compartilhados.

O plano foi dividido em 4 rodadas:

┌────────┬───────────────────────────────────────────────────────────────┐
│ Rodada │                            Entrega                            │
├────────┼───────────────────────────────────────────────────────────────┤
│ 1      │ Pacotes comuns, shell e zona Pedidos, só com leitura de dados │
├────────┼───────────────────────────────────────────────────────────────┤
│ 2      │ Passa a aceitar escrita (editar e excluir)                    │
├────────┼───────────────────────────────────────────────────────────────┤
│ 3      │ Dados em tempo real e segunda zona                            │
├────────┼───────────────────────────────────────────────────────────────┤
│ 4      │ Pacote visual @erp/ui e terceira zona                         │
└────────┴───────────────────────────────────────────────────────────────┘

2. Onde estamos

O trabalho corre em duas frentes:

- A. Prova de conceito (PoC) no repositório nextjs-mfe. É uma versão simplificada para provar como o mecanismo funciona (Multi-Zones, rewrites, isolamento de falha com 503, moldura visual compartilhada via @mfe/shell-ui).
- B. Pacotes comuns nos repositórios erp-nucleo e erp-contratos, que são a base do sistema real.

3. O que falta

A. Fechar a prova de conceito (perto do fim)

Já está provado que:
- o shell repassa as requisições para a zona;
- a queda da zona fica isolada (503 com Retry-After e página /erro-de-zona);
- cabeçalho e menu são compartilhados (@mfe/shell-ui);
- as telas antigas voltaram (abas por query ?tab=, mapa com rota /mapa/[cidade] e dados em tempo real via SSE).

Falta:

1. Passar pela última revisão automática (Gate 4). Três verificadores independentes conferem cada mudança: um revisa o código, outro testa o sistema sob estresse e o terceiro confere se os testes pegam erros de verdade. Na última rodada (iteração 3), o auditor barrou dois pontos (V1: teste comportamental do emitToast na zona; V2: teste de wiring do onSessionChange na zona). Ambos foram corrigidos no commit d128dff, mas a revisão formal (Gate 4) ainda não rodou de novo para confirmar e autorizar o push para o fork.
2. Corrigir problemas conhecidos que foram adiados (DEFERRED.md):
   - Vazamento no SSE (D1). O SSE (Server-Sent Events) é o canal em que o servidor envia dados em tempo real para a tela. Quando o usuário fecha a tela, o servidor continua enviando dados sem parar (ocorre tanto via proxy quanto direto na porta 3001).
   - Zona travada (D7). Se a zona trava sem cair de vez (ex.: loop ou SIGSTOP), uma requisição dentro da janela de cache pode esperar até 30 segundos pelo timeout do proxy do Next.js antes de devolver 500.
   - Moldura compartilhada (D11). Há pequenas diferenças visuais de CSS entre o shell e a zona, e a validação de sessão e acessibilidade ainda são frágeis.
3. Cobrir o que só roda no navegador (D9, D10). Código que executa exclusivamente em useEffect não é coberto nos testes porque o react-dom/server não roda efeitos e falta uma ferramenta que simula o navegador nos testes (ex.: jsdom ou React Testing Library). Instalar essa ferramenta depende de aprovação.

B. Rodada 1 real (parada desde 9 de setembro)

- @erp/contratos: pronto e publicado.
- @erp/nucleo: metade feita. A tarefa 5 (sessão e identidade) foi revisada e novos ajustes foram aplicados. O mais importante deles impede que qualquer código chegue ao token de acesso do usuário. As tarefas 6 a 11 não começaram.
- Ainda não existem:
  - o shell real;
  - a zona Pedidos;
  - o stub de domínio, um servidor falso que imita o sistema de negócio para testes.

C. Rodadas 2 a 4

| Tema | Hoje (PoC em nextjs-mfe) | Alvo / O que falta |
|---|---|---|
| Login e permissões | Usuário simulado espelhado no localStorage só no navegador (D3) | OIDC, cookie opaco __Host-session e Redis funcionando, com a permissão checada no servidor por toda zona |
| Escrita | Somente leitura | Editar e excluir com proteção de concorrência contra duas pessoas alterando o mesmo registro ao mesmo tempo |
| Várias zonas | Apenas uma zona (/remote-app), com o nome escrito à mão em seis lugares | Uma lista única de zonas da qual se geram rotas, rewrites, matcher e menus dinamicamente |
| Fragmentos | Fragmento de demonstração sem consumidor | Primeiro uso real via FragmentoRemoto, com timeout de 2s e circuit breaker |
| Tempo real centralizado | Conexão SSE direta na zona por página, com vazamento de intervalo (D1) | Uma única conexão SSE por aba via /api/stream no shell, gerenciada por SharedWorker compartilhado |
| Pacote visual | @mfe/shell-ui copiado e compilado no workspace de cada app | Publicar o @erp/ui em registry com controle de semver tolerante |
| Tecnologia | Next.js 15 com Pages Router | Migrar para Next.js 16 com App Router (React Server Components, proxy.ts) |
| Publicação e Deploy | Deploy local via pnpm start | Deploy independente por time, com checagem automática no CI (lockstep) que impede versão incompatível do núcleo |

D. Perguntas que o próprio desenho deixou em aberto

- Renovação do login ao mesmo tempo. Várias zonas podem tentar renovar a mesma sessão simultaneamente; isso precisa ser coordenado antes da ida para produção e depende de respostas do provedor de identidade.
- Limite de requisições. Falta rate limiting na borda para limitar quantas requisições um usuário pode fazer por segundo e evitar que percorra registros testando identificadores em sequência ou crie tempestade de reconexão SSE.
- Rastreamento entre zonas. Não há como seguir uma mesma ação do usuário de uma zona para outra nas ferramentas de monitoramento (falta propagação de trace_id / OpenTelemetry).
- Código repetido entre zonas. O navegador baixa de novo o mesmo código-base (framework e libs) ao navegar de uma zona para outra, cerca de 45 kB por travessia. Ainda falta medir se isso importa na prática com cache de CDN.
- Topologia de rede fora da Vercel. Operar proxy reverso L7 (nginx/Traefik com proxy_buffering off para SSE) e garantir co-localização dos serviços na mesma VPC para manter RTT_lan < 5ms.

Ordem sugerida

1. Rodar de novo a revisão da PoC (Gate 4 sobre d128dff) e fechá-la, enviando para o fork.
2. Retomar o @erp/nucleo a partir dos ajustes da tarefa 5.
3. Construir o shell real, a zona Pedidos e o stub de domínio, o que conclui a Rodada 1.
4. Seguir para o login real e as rodadas 2 a 4.