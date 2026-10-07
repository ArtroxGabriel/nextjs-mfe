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

**H2. Mecanismo** (revisto depois da medição; ver "Avaliação de custo e desempenho" abaixo).
- (h) **Híbrido.** O `proxy.ts` lê o mapa vivo e decide por requisição. A **navegação de documento** (`Sec-Fetch-Dest:
  document`) passa pelo gateway, que entrega a página da base dentro do teto. **RSC, assets e Server Actions** seguem pelo
  redirecionamento rápido do Next, com o mapa vivo. Se uma busca de RSC falhar, o roteador do Next refaz a navegação como
  documento, que cai no gateway e mostra a página. **Recomendado.**
- (b) Gateway para tudo. Entrega a página em todos os casos, mas custa de 2 a 4,5 vezes mais CPU no shell por requisição,
  inclusive para assets e RSC, e tem mais código de proxy próprio para manter.
- (a) Só o redirecionamento em tempo de execução pelo `proxy.ts`. É o mais barato, mas continua com o erro cru: a decisão do
  D7 seria reaberta.

**H3. De onde vem o endereço interno de cada zona?**
- (i) Registro de rota feito pelo script de deploy da zona na gestão de acesso, com auditoria. Uma zona só registra a si
  mesma. **Recomendado.**
- (ii) Um modelo fixo de endereço (`http://erp-{id}:3000`), com só a lista de zonas vindo dos manifestos. Mais simples, mas
  exige DNS uniforme em produção e não serve para o ambiente local, que usa portas diferentes.
- (iv) Registro direto no Redis: o script de deploy grava a própria rota numa chave que só ele escreve (usuário ACL por zona),
  e o shell lê do Redis, que já usa. Dispensa o H4 e as duas rotas novas na gestão de acesso, o que corta duas fatias. Custos:
  sem a auditoria do domínio, um segredo do Redis a mais por zona no deploy, e o Redis passa a ser fonte da verdade do mapa
  (exige persistência ligada).
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

## Avaliação de custo e desempenho (2026-10-07)

**Como foi medido.** Um app Next 16.3.4 de teste, fora do repositório, usando o `node_modules` do shell, na frente de uma
zona falsa (Node puro) que responde HTML de 75 KB e JS de 232 KB, com gzip quando pedido, como uma zona Next. Foram três
variantes: **R**, o rewrite de hoje (o mesmo caminho da opção (a)); **G**, o gateway com `fetch`, como o ADR propunha; **H**,
o gateway com `node:http`, repassando o gzip da zona sem abrir. Carga com keep-alive e 8 s por caso, na mesma máquina (16
núcleos). Os números servem para comparar as variantes, não como capacidade absoluta.

| Caso | R (rewrite) | H (gateway, gzip repassado) | G (gateway com `fetch`) |
|---|---|---|---|
| 1 conexão, página: p50 / p99 | 1,3 / 1,9 ms | 2,0 / 3,1 ms | 2,1 / 3,6 ms |
| 4 conexões, página: p50 / p99 | 1,3 / 3,3 ms | 5,0 / 11,3 ms | 6,1 / 13,5 ms |
| saturado (32), página: req/s | 4.293 | 907 | 693 |
| saturado (32), asset JS: req/s | 3.849 | 864 | 459 |
| CPU do shell por requisição (saturado) | ~0,3 ms | ~1,3 ms | ~1,8 ms (asset: ~5,9 ms) |
| bytes ao navegador, página | 4 KB (gzip) | 4 KB (gzip) | **75 KB (sem compressão)** |

**O que isso quer dizer:**
1. **Latência:** com pouca carga, o gateway acrescenta menos de 1 ms. Uma página de zona de verdade leva dezenas a centenas
   de ms para renderizar, então o usuário não sente.
2. **Capacidade:** cada requisição pelo gateway custa de 2 a 4,5 vezes mais CPU no shell. O shell satura em cerca de um núcleo
   (é um processo JavaScript): no teste, cerca de 900 req/s pelo gateway contra cerca de 4.300 pelo rewrite. Gateway para
   tudo significa mais instâncias de shell para o mesmo tráfego.
3. **Compressão (achado):** com `fetch`, o Node descomprime a resposta da zona, e o Next **não recomprime** a resposta de um
   route handler. A página chegou ao navegador com 75 KB em vez de 4 KB, 18 vezes maior. O gateway precisa repassar os bytes
   comprimidos com `node:http` (variante H). Isso muda a exceção da checagem N8, que hoje só aceita `fetch`.
4. **Por que o híbrido:** a página da base só importa na navegação de documento. Uma busca de RSC que falha vira navegação de
   documento no próprio Next (`fetch-server-response.js:143-148`), que passa pelo gateway. Assets e RSC, a maior parte das
   requisições, ficam no caminho rápido; em produção os assets vão para a CDN.

**Outras questões das recomendações:**
- **H1 (mapa relido a cada 30 s):** custo desprezível, uma leitura por instância a cada 30 s. Com várias instâncias do shell, uma
  zona nova pode aparecer em uma antes da outra, por até um intervalo. Zona removida também leva até um intervalo para sumir.
- **H2 (híbrido):** Server Action numa zona travada continua recebendo o erro cru, porque vai pelo caminho rápido. A zona mostra
  o próprio `error.tsx`. Fica declarado como limite. O código de proxy próprio fica restrito a documentos, cerca de metade da
  matriz de cabeçalhos do gateway completo.
- **H3:** com (i), o roteamento passa a depender da gestão de acesso estar no ar; o último mapa bom no Redis cobre a queda.
  Com (iv), depende só do Redis, que o shell já exige.
- **H4:** só existe com H3 (i).
- **Segurança:** o repasse do cookie à zona já acontece hoje com os rewrites. O risco novo é só o endereço vir de um registro em
  tempo de execução, e é coberto pela lista de padrões no shell.
- **Não medido aqui:** streaming longo, uploads grandes e propagação do cancelamento quando o navegador fecha. Entram como teste
  na fatia do gateway.

## Formato da resposta

Uma linha por decisão, por exemplo `H1: i`, `H2: b`, `H3: i`, `H4: i`, `H5: i`, `H6: i`, mais o que quiser comentar. Se
aceitar o pacote recomendado (H1 i, H2 h, H3 i, H4 i, H5 i, H6 i), basta "pacote recomendado" (o ADR-0015 passa a "aceito").

## Resposta

(vazio até o humano preencher)
