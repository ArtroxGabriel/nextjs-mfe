# Decisões do C3: mapa de zonas vivo

**Estado:** aberto · **Aberto em:** 2026-10-07 · **Para:** o humano responsável pela base.
**O que espera por isto:** o C3 inteiro (#14). Nada do C3 começa antes da resposta.
**Proposta completa:** [`docs/adr/0015-mapa-de-zonas-vivo-e-gateway.md`](../docs/adr/0015-mapa-de-zonas-vivo-e-gateway.md).

## Contexto

A base é um **shell** (porta de entrada; o navegador só fala com ele) na frente de **zonas** (cada módulo é uma aplicação
Next.js própria). Hoje o shell sabe onde está cada zona por um arquivo, o `zonas.json`, que vira regras de redirecionamento
interno (`rewrites`) **na hora do build**. Isso gera dois problemas:

1. **Zona nova exige um build novo do shell.** O objetivo pede o contrário: uma zona nova entra sem mexer no shell.
2. **Zona travada devolve um "Internal Server Error" cru** depois de 10 s. Quem responde é o próprio Next, sem deixar o shell
   pôr a página de erro da base, com o código de suporte. Foi combinado (D7) que o C3 resolveria isso.

Conferimos no código do Next 16: fazer o redirecionamento em tempo de execução, pelo `proxy.ts`, resolve o problema 1, mas não
o 2. Por baixo passa pelo mesmo mecanismo, com o mesmo erro cru.

**A proposta:** o shell passa a encaminhar ele mesmo as requisições de zona (um "gateway", com `fetch`). Ele lê o mapa de
zonas em tempo de execução, na gestão de acesso, e controla o tempo de espera, o que permite responder com a página da base.
A zona continua declarando só `{ id, nome, funcionalidades }`. O endereço interno dela é registrado pelo script de deploy,
não pelo código da zona.

## Pergunta

Seis decisões. Cada uma traz as opções e a recomendação.

**H1. "Sem republicar o shell" inclui não reiniciar o shell?**
- (i) Sim: o shell relê o mapa sozinho, a cada intervalo configurável (proposta: 30 s). **Recomendado:** é o que o requisito diz.
- (ii) Não: basta ler o mapa quando o shell sobe e reiniciá-lo quando entra uma zona nova. É mais simples, mas cada zona nova
  passa por um reinício do shell.

**H2. Mecanismo.**
- (b) Gateway no shell. Entrega a página da base dentro do teto. Custos: um salto a mais por requisição (vamos medir), e zona
  não pode usar WebSocket (o SSE já é do shell, então não atrapalha). **Recomendado.**
- (a) Redirecionamento em tempo de execução pelo `proxy.ts`. Mais barato, mas continua com o erro cru: a decisão do D7 seria
  reaberta.

**H3. De onde vem o endereço interno de cada zona?**
- (i) Registro de rota feito pelo script de deploy da zona na gestão de acesso, com auditoria. Uma zona só registra a si
  mesma. **Recomendado.**
- (ii) Um modelo fixo de endereço (`http://erp-{id}:3000`), com só a lista de zonas vindo dos manifestos. Mais simples, mas
  exige DNS uniforme em produção e não serve para o ambiente local, que usa portas diferentes.
- (iii) Arquivo ou ConfigMap montado no shell. Na prática é o `zonas.json` com outro nome: não atende o objetivo.

**H4. Credencial do shell para ler o mapa.** Ler o mapa exige uma credencial de serviço própria do shell, o que adianta um
pedaço do G5, que tinha ficado para depois do objetivo.
- (i) Adiantar só esse pedaço, com escopo mínimo (só ler o mapa). **Recomendado.**
- (ii) Esperar o G5. Nesse caso o C3 fica parado.

**H5. Zona que trava depois de já ter começado a responder.** A página da base só pode sair antes do primeiro byte da zona;
depois disso o status já foi enviado.
- (i) Teto até o primeiro byte, com página da base. Depois disso, um tempo máximo de silêncio entre pedaços corta a resposta,
  sem página (limite declarado). O carregamento progressivo das páginas continua funcionando. **Recomendado.**
- (ii) O shell segura a resposta inteira até o teto para sempre poder trocar pela página. Tira o carregamento progressivo de
  todas as zonas.

**H6. O `zonas.json` depois da migração.**
- (i) Apagar: uma fonte só. O showcase registra as zonas pelo `task`. **Recomendado.**
- (ii) Manter como semente de desenvolvimento, com o risco de duas fontes divergirem.

**Risco a aceitar junto (vale para qualquer opção do H3):** o shell repassa à zona o cookie de sessão do usuário. Quem
consegue registrar um endereço falso para uma zona recebe a sessão de quem abre aquela zona. As defesas são três: só a própria
zona registra a si mesma; o shell só aceita endereços que casam uma lista configurada de padrões; e todo registro fica
auditado.

## Formato da resposta

Uma linha por decisão, por exemplo `H1: i`, `H2: b`, `H3: i`, `H4: i`, `H5: i`, `H6: i`, mais o que quiser comentar. Se
aceitar o pacote recomendado, basta "pacote recomendado" (o ADR-0015 passa a "aceito").

## Resposta

(vazio até o humano preencher)
