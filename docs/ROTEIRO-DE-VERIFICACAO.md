# Roteiro de verificação manual

## As 7 funcionalidades básicas

Uma linha por funcionalidade: o que fazer no navegador, o que deve acontecer e o teste de `task showcase:verificar` que prova a mesma coisa (os testes levam o código da primeira coluna no título). Os passos A abaixo detalham cada linha.

| # | Funcionalidade | Faça | Deve acontecer | Teste | Passos |
|---|---|---|---|---|---|
| F1 | o shell renderiza | Entre como **ana** e abra `/` | a moldura com cabeçalho, menu e botão Sair; sem sessão, `/` vai ao login | F1 | A1, A2, A3 |
| F2 | há zonas | Suba `task showcase:zona-demo` e abra `/demo` | a zona de demonstração aparece sem reiniciar o shell, em até um TTL do mapa (30 s por padrão) mais uma releitura, e some depois de removida | F2 | A14 |
| F3 | as zonas se integram | Navegue entre `/zona1` e `/zona2`, veja o bloco de tarefas no painel da zona 1 e saia | o mesmo menu nas zonas, o bloco da zona 2 só para quem tem os dois módulos, e o Sair encerra a sessão em todas | F3 | A3, A11, A13 |
| F4 | os tratamentos | Abra `/zona1/recursos/r-3` como carla, `/zona1/relatorios` como bruno e uma zona fora do ar | 404 sem página de "sem acesso"; zona fora do ar dá 503 com a página da base e o código de suporte, e o resto segue respondendo | F4 | A4, A7, A9, A12, A15 |
| F5 | base de UI | Compare o cabeçalho e o menu nas três zonas e clique **Avisar no toast do shell** | a mesma moldura em todas e o toast aparece pela moldura | F5 | A3, A5, A6 |
| F6 | bases em pacotes separados | Nada a fazer no navegador: confira os `package.json` das quatro apps | `@erp/contratos`, `@erp/nucleo` e `@erp/moldura` em versão exata, o núcleo na mesma versão em todas | F6 | (só pelo teste) |
| F7 | integração com os domínios | Abra `/zona1/recursos/r-1` como bruno e como carla | o custo aparece só para quem é do financeiro (o bruno vê, a carla não); a recusa de mutação com versão desatualizada (412) só é provada pelo teste | F7 | A7 |

## Base genérica em `repos/`

Leva uns 10 minutos. A verificação automática faz o mesmo por HTTP:
`task verificar` (esperado: a suíte inteira passa, `fail 0` no resumo; com a sessão no Redis do showcase,
`task verificar:redis`, sem nenhum pulado).

**Preparar.** `task showcase` (ou só `task base`, sem Redis e Keycloak). Com o showcase no ar,
`task showcase:conferir` mostra de uma vez o que cada ator vê em cada zona (nos dois modos de login), e
`task showcase:verificar` roda os testes F1 a F7 da tabela acima; os passos abaixo são o
mesmo, à mão, no navegador. No showcase os dados dos domínios ficam gravados: o que A6 e A8 mudam
continua depois de reiniciar, e `task showcase:dados:resetar` volta tudo à semente. Se o estado gravado for
anterior à semente atual (um ator que não existe nele, como a eva), `task showcase` avisa e sugere esse reset. Use `http://localhost:3000`, não `127.0.0.1`: o cookie
`__Host-session` exige origem segura, e o navegador só trata `localhost` assim.

| # | Faça | Deve acontecer | Requisito |
|---|---|---|---|
| A1 | Abra `/zona1` sem ter entrado | vai para `/login?de=%2Fzona1` | camada 1 |
| A2 | Entre como **ana** | volta para `/`; o cookie `__Host-session` é HttpOnly e só um UUID | N3 |
| A3 | Veja o menu | Início, Painel da zona 1, Tarefas; o mesmo menu em `/zona1` e `/zona2`, com o item atual marcado | N4, N5 |
| A4 | Abra `/zona1/relatorios` e `/acesso` digitando a URL | 404, sem página de "sem acesso" | N5, D6 |
| A5 | Em `/zona1`, clique **Avisar no toast do shell** | toast no canto, disparado pela zona | N4 |
| A6 | Em `/zona2`, clique **Concluir e ir para a zona 1** | a página muda para `/zona1` e o toast "Tarefa concluída." aparece uma vez; recarregar não o repete | N4 |
| A7 | Saia e entre como **carla**; abra `/zona1/recursos/r-1` | sem a seção Custo; `/zona1/recursos/r-3` dá 404 | dado é do domínio |
| A8 | Como carla, em `/acesso`, desligue a célula `zona1.analista` × Relatórios | toast "Concessão atualizada." | N5, N6 |
| A9 | Em outra janela anônima, entre como **bruno** e abra `/zona1/relatorios` | 404 e o item sumiu do menu, sem novo login; religue em A8 e ele volta | D7 |
| A10 | Em `/acesso`, procure a célula `zona1.analista` × Tarefas | não existe: perfil de zona não concede módulo de outra zona | D8 |
| A11 | Clique **Sair** e use o botão Voltar do navegador | qualquer página volta ao login: a sessão acabou em todas as zonas | N3 |
| A12 | Derrube só a zona 2 (Ctrl-C no processo dela ou `kill` na porta 3002) e abra `/zona2` | 503 com `Retry-After: 5` e a página "zona indisponível"; `/` e `/zona1` seguem funcionando. Suba a zona de volta: em até ~1,5 s `/zona2` volta (medido 0,8–1,2 s) | falha isolada de zona (gate aprovado) |
| A13 | Como **ana**, abra `/zona1`; depois entre como **bruno** e como **davi** e abra `/zona1` de novo | só a ana vê o bloco "Tarefas pendentes (zona 2)" no painel; para bruno e davi o bloco simplesmente não existe | C1 |
| A14 | Com o showcase no ar, rode `task showcase:zona-demo` noutro terminal e abra `/demo`; Enter derruba a zona, Enter de novo a traz de volta, Ctrl-C remove a rota | a página `/demo` aparece sem reiniciar o shell, em até um TTL do mapa (`ERP_MAPA_ZONAS_TTL_MS`, 30 s por padrão) mais uma releitura; derrubada, a página de zona fora do ar aparece já no próximo carregamento; de volta, a página volta; removida a rota, `/demo` volta a dar 404 no mesmo prazo da entrada | C3, D7 |
| A15 | Com a zona 2 derrubada (A12) ou a demo derrubada (A14), abra a página da zona | página "Zona temporariamente indisponível" com um "Código de suporte"; o mesmo código está no registro do shell; nenhum nome de classe nem stack | invariante 12 |

Com `task showcase:oidc` o mesmo roteiro vale com login pelo Keycloak: em A2, "Entrar" leva ao formulário
do Keycloak (usuário e senha = nome do ator) e volta ao shell; em A11, "Sair" encerra a sessão no shell e leva
à página de confirmação de logout do Keycloak (a URL não leva `id_token_hint`, então ele pergunta); confirmando, o
Keycloak volta a `/login` do shell, e o próximo "Entrar" pede senha de novo (a sessão SSO acabou). Sem confirmar,
a sessão no shell já acabou, mas a do Keycloak continua: um novo "Entrar" volta sem pedir senha.
A renovação do token é invisível: a página continua abrindo depois dos 5 min de vida do primeiro token
(`task verificar:oidc` prova isso com um token de 20 s).

A PoC anterior tinha um roteiro próprio (Parte B deste arquivo), preservado na tag `poc-final`.
