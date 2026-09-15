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

- A. Prova de conceito (PoC) no repositório nextjs-mfe. É uma versão simplificao funciona.
- B. Pacotes comuns nos repositórios erp-nucleo e erp-contratos, que são a base

3. O que falta

A. Fechar a prova de conceito (perto do fim)

Já está provado que:
- o shell repassa as requisições para a zona;
- a queda da zona fica isolada;
- cabeçalho e menu são compartilhados;
- as telas antigas voltaram (abas, mapa e dados em tempo real).

Falta:

1. Passar pela última revisão automática. Três verificadores independentes conferem cada mudança: um revisa o código, outro testa o sistema sob estresse e o terceiro confere se os testes
   pegam erros de verdade. Na última rodada, o terceiro barrou dois pontos. Os  a revisão ainda não rodou de novo para confirmar.
2. Corrigir problemas conhecidos que foram adiados:
   - Vazamento no SSE. O SSE (Server-Sent Events) é o canal em que o servidor e a tela. Quando o usuário fecha a tela, o servidor continua enviando dados sem
     parar.
   - Zona travada. Se a zona trava sem cair de vez, uma requisição pode esperaro.
   - Moldura compartilhada. Há diferenças visuais entre o shell e a zona, e a vilidade ainda são frágeis.
3. Cobrir o que só roda no navegador. Esse código não tem teste porque falta umramenta que simula o navegador nos testes. Instalar essa ferramenta depende da
   sua aprovação.

B. Rodada 1 real (parada desde 9 de setembro)

- @erp/contratos: pronto e publicado.
- @erp/nucleo: metade feita. A tarefa 5 (sessão e identidade) foi revisada e voo foram aplicados. O mais importante deles impede que qualquer código chegue aotoken de acesso do usuário. As tarefas 6 a 11 não começaram.
- Ainda não existem:
  - o shell real;
  - a zona Pedidos;
  - o stub de domínio, um servidor falso que imita o sistema de negócio para testes.

C. Rodadas 2 a 4

┌─────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│          Tema           │                                                                                                                      │
├─────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Login e permissões      │ OIDC, cookie e Redis funcionando, com a permissão cuário é simulado e fica só no navegador.                          │
├─────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Escrita                 │ Editar e excluir com proteção contra duas pessoas amesmo tempo.                                                      │
├─────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Várias zonas            │ Uma lista única de zonas da qual se geram rotas e m o nome escrito à mão em seis lugares.                            │
├─────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Fragmentos              │ Primeiro uso real, com timeout e circuit breaker.                                                                    │
├─────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tempo real centralizado │ Uma única conexão SSE por aba, gerenciada pelo shelso do navegador que várias páginas abertas podem compartilhar).   │
├─────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Pacote visual           │ Publicar o @erp/ui. Hoje os componentes ficam copia                                                                  │
├─────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tecnologia              │ Migrar para Next.js 16 com App Router, o modelo mais novo de rotas do framework.                                     │
├─────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Publicação              │ Deploy independente por time, com uma checagem autoede uma zona de rodar com versão incompatível dos pacotes comuns. │
└─────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

D. Perguntas que o próprio desenho deixou em aberto

- Renovação do login ao mesmo tempo. Várias zonas podem tentar renovar a mesma a ida para produção e depende de respostas do provedor de identidade.
- Limite de requisições. Falta limitar quantas requisições um usuário pode fazercorra registros testando identificadores em sequência.
- Rastreamento entre zonas. Não há como seguir uma mesma ação do usuário de umas de monitoramento.
- Código repetido entre zonas. O navegador baixa de novo o mesmo código-base (fna para outra, cerca de 45 kB por travessia. Ainda falta medir se isso importana prática.

Ordem sugerida

1. Rodar de novo a revisão da PoC e fechá-la.
2. Retomar o @erp/nucleo a partir dos ajustes da tarefa 5.
3. Construir o shell real, a zona Pedidos e o stub de domínio, o que conclui a
4. Seguir para o login real e as rodadas 2 a 4.